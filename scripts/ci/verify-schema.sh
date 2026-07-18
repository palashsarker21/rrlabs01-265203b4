#!/usr/bin/env bash
# Detect schema drift between committed migrations and the live Supabase project.
# Requires: `supabase link` already executed and SUPABASE_DB_PASSWORD in env.
set -euo pipefail

SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
OUT="$(mktemp)"

echo "→ Running supabase db diff (public schema)..."
if ! supabase db diff --linked --schema public > "$OUT" 2>&1; then
  echo "::error::supabase db diff failed"
  cat "$OUT"
  echo "## 🧭 Schema Drift" >> "$SUMMARY"
  echo "❌ \`supabase db diff\` command failed." >> "$SUMMARY"
  exit 1
fi

# Non-empty, non-whitespace output means drift.
if grep -Ev '^\s*(--.*)?$' "$OUT" | grep -q .; then
  echo "::error::Schema drift detected against production."
  {
    echo "## 🧭 Schema Drift"
    echo ""
    echo "❌ **Drift detected.** Commit a migration reflecting these changes:"
    echo ""
    echo '```sql'
    head -c 8000 "$OUT"
    echo ""
    echo '```'
  } >> "$SUMMARY"
  cat "$OUT"
  exit 1
fi

echo "✓ No schema drift."
echo "## 🧭 Schema Drift" >> "$SUMMARY"
echo "✅ No schema drift detected." >> "$SUMMARY"
