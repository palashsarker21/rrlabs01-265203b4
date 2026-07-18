#!/usr/bin/env bash
# Validate that every required GitHub Secret / environment variable is present.
# Never prints secret values.
set -euo pipefail

REQUIRED=(
  SUPABASE_PROJECT_REF
  SUPABASE_ACCESS_TOKEN
  SUPABASE_DB_PASSWORD
  SUPABASE_URL
  SUPABASE_PUBLISHABLE_KEY
  SUPABASE_SERVICE_ROLE_KEY
  DATABASE_URL
)

missing=()
present=()
for var in "${REQUIRED[@]}"; do
  if [ -z "${!var:-}" ]; then
    missing+=("$var")
  else
    present+=("$var")
  fi
done

{
  echo "## 🔐 Secrets Validation"
  echo ""
  echo "| Secret | Status |"
  echo "| ------ | ------ |"
  for v in "${present[@]}"; do echo "| \`$v\` | ✅ present |"; done
  for v in "${missing[@]}"; do echo "| \`$v\` | ❌ MISSING |"; done
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

if [ ${#missing[@]} -gt 0 ]; then
  echo "::error::Missing required secrets: ${missing[*]}"
  exit 1
fi

# Basic shape checks (non-fatal warnings only, values never printed).
if [[ ! "${SUPABASE_PROJECT_REF}" =~ ^[a-z0-9]{16,}$ ]]; then
  echo "::warning::SUPABASE_PROJECT_REF does not look like a valid project ref."
fi
if [[ ! "${DATABASE_URL}" =~ ^postgres(ql)?:// ]]; then
  echo "::warning::DATABASE_URL does not start with postgres:// or postgresql://"
fi

echo "✓ All ${#REQUIRED[@]} required secrets are present."
