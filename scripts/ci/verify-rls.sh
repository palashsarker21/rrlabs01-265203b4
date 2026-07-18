#!/usr/bin/env bash
# Executes the production security assertions in security-checks.sql against
# the linked Supabase project. Requires SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_REF.
set -euo pipefail

SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD is required}"

# Prefer explicit DATABASE_URL when provided; fall back to the standard pooler URL.
CONN="${DATABASE_URL:-postgresql://postgres.${SUPABASE_PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres}"

OUT="$(mktemp)"
if PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CONN" \
     -v ON_ERROR_STOP=1 \
     -f scripts/ci/security-checks.sql > "$OUT" 2>&1; then
  echo "✓ Security checks passed."
  {
    echo "## 🛡️  Security Checks"
    echo ""
    echo "✅ RLS, grants, and SECURITY DEFINER audits passed."
  } >> "$SUMMARY"
  tail -n 20 "$OUT"
else
  echo "::error::Security checks failed."
  {
    echo "## 🛡️  Security Checks"
    echo ""
    echo "❌ Security assertions failed:"
    echo '```'
    tail -c 4000 "$OUT"
    echo '```'
  } >> "$SUMMARY"
  cat "$OUT"
  exit 1
fi
