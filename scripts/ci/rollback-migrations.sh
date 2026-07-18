#!/usr/bin/env bash
# Automated safe backout for migrations that failed or partially applied.
#
# Strategy:
#   1. Diff applied-before.txt vs current remote state → newly-applied versions.
#   2. For each new version (in REVERSE order), look for a paired down-migration
#      at supabase/migrations/rollback/<version>_*.sql.
#   3. Apply each down-migration inside its own transaction via psql.
#   4. Call `supabase migration repair --status reverted <version>` to clear
#      the bookkeeping row so a future push replays the fixed forward file.
#   5. If ANY newly-applied migration has no matching rollback file, ABORT
#      automatic rollback and surface a "manual intervention required" error
#      with the pre-migration schema dump attached as an artifact.
#
# Env inputs:
#   ARTIFACT_DIR   directory containing applied-before.txt + schema-before.sql
#   DATABASE_URL   direct Postgres connection string (required)
#   STRICT         "1" to require rollback files for every new migration (default)
set -euo pipefail

ARTIFACT_DIR="${ARTIFACT_DIR:-/tmp/pre-migration}"
ROLLBACK_DIR="scripts/ci/rollback"
STRICT="${STRICT:-1}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

if [ ! -f "$ARTIFACT_DIR/applied-before.txt" ]; then
  echo "::error::Missing $ARTIFACT_DIR/applied-before.txt — cannot compute newly-applied migrations."
  echo "## ❌ Rollback aborted — no pre-migration snapshot available" >> "$SUMMARY"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "::error::DATABASE_URL not set — cannot execute rollback SQL."
  exit 1
fi

echo "▸ Capturing current remote migration state for diff…"
RETRIES="${RETRIES:-4}" BASE_DELAY="${BASE_DELAY:-5}" \
  bash "$(dirname "$0")/retry.sh" "supabase migration list (rollback)" -- \
  bash -c 'supabase migration list --linked > /tmp/remote-after.txt'
awk '
  /^[[:space:]]*[0-9]{14}[[:space:]]*\|[[:space:]]*[0-9]{14}/ {
    split($0, a, "|"); gsub(/ /,"",a[2]); print a[2]
  }
  /^[[:space:]]*\|[[:space:]]*[0-9]{14}/ {
    split($0, a, "|"); gsub(/ /,"",a[2]); print a[2]
  }
' /tmp/remote-after.txt | sort -u > /tmp/applied-after.txt

NEW_VERSIONS=$(comm -13 "$ARTIFACT_DIR/applied-before.txt" /tmp/applied-after.txt || true)

if [ -z "$NEW_VERSIONS" ]; then
  echo "✓ No newly-applied migrations detected. Nothing to roll back."
  echo "## ↩️ Rollback: nothing to do (no migrations were committed)" >> "$SUMMARY"
  exit 0
fi

echo "▸ Newly-applied migrations to reverse (in reverse order):"
REVERSED=$(printf '%s\n' "$NEW_VERSIONS" | sort -r)
echo "$REVERSED"

# Pre-flight: ensure every new version has a rollback file (strict mode).
MISSING=()
declare -A ROLLBACK_FILE
while IFS= read -r ver; do
  [ -z "$ver" ] && continue
  match=$(ls "$ROLLBACK_DIR"/"$ver"_*.sql 2>/dev/null | head -n1 || true)
  if [ -z "$match" ]; then
    MISSING+=("$ver")
  else
    ROLLBACK_FILE[$ver]="$match"
  fi
done <<< "$REVERSED"

if [ "${#MISSING[@]}" -gt 0 ] && [ "$STRICT" = "1" ]; then
  {
    echo "## 🚨 Automatic rollback ABORTED — missing down-migration files"
    echo ""
    echo "The following newly-applied migrations have no paired rollback script under \`$ROLLBACK_DIR/\`:"
    echo ""
    for v in "${MISSING[@]}"; do echo "- \`$v\`"; done
    echo ""
    echo "**Manual intervention required.** The pre-migration schema dump is attached as the \`pre-migration-snapshot\` artifact; a DBA must restore it or hand-write the down-migrations before re-running the workflow."
  } >> "$SUMMARY"
  echo "::error::Cannot roll back — missing rollback files for: ${MISSING[*]}"
  exit 2
fi

# Execute rollbacks in reverse chronological order, each in its own transaction.
FAILED=()
APPLIED=()
while IFS= read -r ver; do
  [ -z "$ver" ] && continue
  file="${ROLLBACK_FILE[$ver]:-}"
  if [ -z "$file" ]; then
    echo "::warning::No rollback file for $ver (strict=0) — skipping SQL, only clearing bookkeeping."
  else
    echo "▸ Applying rollback for $ver: $file"
    if psql "$DATABASE_URL" \
        --single-transaction \
        --set ON_ERROR_STOP=1 \
        --file "$file"; then
      echo "  ✓ SQL rollback applied for $ver"
    else
      echo "::error::Rollback SQL failed for $ver — halting further rollback."
      FAILED+=("$ver")
      break
    fi
  fi

  echo "▸ Clearing migration bookkeeping for $ver"
  if supabase migration repair --status reverted "$ver" --linked --password "$SUPABASE_DB_PASSWORD"; then
    APPLIED+=("$ver")
  else
    echo "::error::migration repair failed for $ver"
    FAILED+=("$ver")
    break
  fi
done <<< "$REVERSED"

{
  echo "## ↩️ Automatic rollback executed"
  echo ""
  echo "- Reverted: **${#APPLIED[@]}**"
  for v in "${APPLIED[@]}"; do echo "  - ✅ \`$v\`"; done
  if [ "${#FAILED[@]}" -gt 0 ]; then
    echo "- Failed: **${#FAILED[@]}**"
    for v in "${FAILED[@]}"; do echo "  - ❌ \`$v\` (manual intervention required)"; done
  fi
} >> "$SUMMARY"

if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "::error::Rollback halted with failures. See workflow summary."
  exit 3
fi

echo "✓ Rollback complete."
