#!/usr/bin/env bash
# Capture a pre-migration snapshot so a failed / partially-applied
# db push can be rolled back deterministically.
#
# Outputs written to $ARTIFACT_DIR (default /tmp/pre-migration):
#   - applied-before.txt   sorted list of migration versions already applied
#   - schema-before.sql    full schema dump (structure only, no data)
#   - remote-migrations.txt raw `supabase migration list` output
#
# Requires: supabase CLI already logged in + linked, $DATABASE_URL set.
set -euo pipefail

ARTIFACT_DIR="${ARTIFACT_DIR:-/tmp/pre-migration}"
mkdir -p "$ARTIFACT_DIR"

echo "▸ Capturing remote migration state…"
supabase migration list --linked | tee "$ARTIFACT_DIR/remote-migrations.txt" >/dev/null

# Extract applied versions (14-digit timestamps in the REMOTE column).
# `supabase migration list` prints:  LOCAL | REMOTE | TIME
awk '
  /^[[:space:]]*[0-9]{14}[[:space:]]*\|[[:space:]]*[0-9]{14}/ {
    # both local + remote populated → already applied
    split($0, a, "|"); gsub(/ /,"",a[2]); print a[2]
  }
  /^[[:space:]]*\|[[:space:]]*[0-9]{14}/ {
    # only remote populated (applied on remote, not in repo)
    split($0, a, "|"); gsub(/ /,"",a[2]); print a[2]
  }
' "$ARTIFACT_DIR/remote-migrations.txt" | sort -u > "$ARTIFACT_DIR/applied-before.txt"

echo "▸ Applied migrations before push:"
cat "$ARTIFACT_DIR/applied-before.txt" || true

echo "▸ Dumping current schema (structure only)…"
if [ -n "${DATABASE_URL:-}" ]; then
  # Use pg_dump directly for a portable, deterministic dump.
  pg_dump \
    --schema-only \
    --no-owner \
    --no-privileges \
    --schema=public \
    --file="$ARTIFACT_DIR/schema-before.sql" \
    "$DATABASE_URL"
  echo "✓ Schema dump saved to $ARTIFACT_DIR/schema-before.sql ($(wc -l < "$ARTIFACT_DIR/schema-before.sql") lines)"
else
  echo "::warning::DATABASE_URL not set; skipping pg_dump snapshot."
fi

{
  echo "## 📸 Pre-migration snapshot"
  echo ""
  echo "- Applied migrations captured: **$(wc -l < "$ARTIFACT_DIR/applied-before.txt")**"
  echo "- Schema dump: $( [ -f "$ARTIFACT_DIR/schema-before.sql" ] && echo '✅' || echo '⚠️ skipped' )"
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
