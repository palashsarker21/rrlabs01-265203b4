#!/usr/bin/env bash
# Validate supabase/migrations/ before applying to production.
# - Timestamp-prefixed filenames (YYYYMMDDHHMMSS_*.sql)
# - Strictly increasing chronological order
# - No duplicate timestamps
# - Reasonable timestamps (not in far future, not before 2020)
# - Non-empty files
# - Basic SQL sanity (contains at least one statement, balanced $$ blocks)
set -euo pipefail

DIR="supabase/migrations"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

{
  echo "## 🧪 Migration Validation"
  echo ""
} >> "$SUMMARY"

if [ ! -d "$DIR" ]; then
  echo "No migrations directory; skipping."
  echo "_No migrations directory._" >> "$SUMMARY"
  exit 0
fi

shopt -s nullglob
files=("$DIR"/*.sql)
count=${#files[@]}
if [ "$count" -eq 0 ]; then
  echo "No migration files."
  echo "_No migration files._" >> "$SUMMARY"
  exit 0
fi

prev=""
declare -A seen
fail=0
now_ts="$(date -u +%Y%m%d%H%M%S)"
max_ts=$(( 10#$now_ts + 1000000 ))   # ~ +100 days grace

for f in $(printf '%s\n' "${files[@]}" | sort); do
  base="$(basename "$f")"

  if [[ ! "$base" =~ ^([0-9]{14})_[A-Za-z0-9._-]+\.sql$ ]]; then
    echo "::error file=$f::Invalid filename (need YYYYMMDDHHMMSS_name.sql): $base"
    fail=1; continue
  fi
  ts="${BASH_REMATCH[1]}"

  # Duplicate timestamp
  if [ -n "${seen[$ts]:-}" ]; then
    echo "::error file=$f::Duplicate migration timestamp $ts"
    fail=1
  fi
  seen[$ts]=1

  # Ordering
  if [ -n "$prev" ] && [[ "$ts" < "$prev" ]]; then
    echo "::error file=$f::Out-of-order migration ($ts < $prev)"
    fail=1
  fi
  prev="$ts"

  # Sanity bounds
  ts_num=$((10#$ts))
  if [ "$ts_num" -lt 20200101000000 ]; then
    echo "::error file=$f::Timestamp $ts is before 2020"
    fail=1
  fi
  if [ "$ts_num" -gt "$max_ts" ]; then
    echo "::error file=$f::Timestamp $ts is too far in the future"
    fail=1
  fi

  # Non-empty
  if [ ! -s "$f" ]; then
    echo "::error file=$f::Migration file is empty"
    fail=1; continue
  fi

  # Contains at least one semicolon (surface-level SQL sanity)
  if ! grep -q ';' "$f"; then
    echo "::error file=$f::Migration contains no SQL statements"
    fail=1
  fi

  # Balanced $$ blocks
  dollar_count=$(grep -c '\$\$' "$f" || true)
  if [ $((dollar_count % 2)) -ne 0 ]; then
    echo "::error file=$f::Unbalanced \$\$ blocks in migration"
    fail=1
  fi
done

{
  echo "- Total migrations: **$count**"
  echo "- Validation: $( [ "$fail" -eq 0 ] && echo '✅ passed' || echo '❌ failed' )"
} >> "$SUMMARY"

if [ "$fail" -ne 0 ]; then
  echo "Migration validation FAILED."
  exit 1
fi

echo "✓ Validated $count migration file(s)."
