#!/usr/bin/env bash
# Writes the final deployment summary section.
set -euo pipefail
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
{
  echo ""
  echo "## 🚀 Deployment"
  echo ""
  echo "| Gate | Status |"
  echo "| ---- | ------ |"
  echo "| Secrets validation | ✅ |"
  echo "| Supabase auth + link | ✅ |"
  echo "| Migration file validation | ✅ |"
  echo "| Lint / Typecheck / Build | ✅ |"
  echo "| Migrations applied | ✅ |"
  echo "| Schema drift | ✅ none |"
  echo "| Security checks | ✅ |"
  echo ""
  echo "**Commit:** \`${GITHUB_SHA:-unknown}\`"
  echo "**Ref:** \`${GITHUB_REF:-unknown}\`"
  echo "**Actor:** \`${GITHUB_ACTOR:-unknown}\`"
  echo ""
  echo "All production gates passed. Application deploys via the Lovable publish pipeline."
} >> "$SUMMARY"
