#!/usr/bin/env bash
# Validate supabase/migrations/ before applying to production.
# - Timestamp-prefixed filenames (YYYYMMDDHHMMSS_*.sql)
# - Strictly increasing chronological order
# - No duplicate timestamps
# - Non-empty, parseable SQL (surface-level check)
set -euo pipefail

DIR="supabase/migrations"
if [ ! -d "$DIR" ]; then
  echo "No migrations directory; skipping."
  exit 0
fi

shopt -s nullglob
files=("$DIR"/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "No migration files."
  exit 0
fi

prev=""
declare -A seen
fail=0
for f in $(printf '%s\n' "${files[@]}" | sort); do
  base="$(basename "$f")"
  if [[ ! "$base" =~ ^([0-9]{14})_.+\.sql$ ]]; then
    echo "::error file=$f::Filename must start with 14-digit timestamp: $base"
    fail=1; continue
  fi
  ts="${BASH_REMATCH[1]}"
  if [ -n "${seen[$ts]:-}" ]; then
    echo "::error file=$f::Duplicate timestamp $ts"
    fail=1
  fi
  seen[$ts]=1
  if [ -n "$prev" ] && [[ "$ts" < "$prev" ]]; then
    echo "::error file=$f::Out-of-order migration ($ts < $prev)"
    fail=1
  fi
  prev="$ts"
  if [ ! -s "$f" ]; then
    echo "::error file=$f::Migration is empty"
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "Migration validation FAILED."
  exit 1
fi
echo "Validated ${#files[@]} migration file(s)."
