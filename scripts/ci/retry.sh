#!/usr/bin/env bash
# retry.sh — run a command with exponential backoff for transient/network failures.
#
# Usage:  bash scripts/ci/retry.sh <label> -- <cmd...>
# Env:    RETRIES (default 4)   MAX attempts including the first try
#         BASE_DELAY (default 5) seconds; delay = BASE_DELAY * 2^(attempt-1) + jitter
#         MAX_DELAY (default 60) cap per sleep
#         RETRY_ON_EXIT (optional CSV) restrict retries to specific exit codes
#
# Rules:
# - Retries only on non-zero exit AND (RETRY_ON_EXIT unset OR exit code matches).
# - Prints attempt banner + backoff duration to stderr so CI logs stay legible.
# - Emits GitHub Actions `::warning::` on each retried failure.
set -uo pipefail

label="${1:-command}"; shift || true
if [ "${1:-}" = "--" ]; then shift; fi

RETRIES="${RETRIES:-4}"
BASE_DELAY="${BASE_DELAY:-5}"
MAX_DELAY="${MAX_DELAY:-60}"
RETRY_ON_EXIT="${RETRY_ON_EXIT:-}"

attempt=1
while :; do
  echo "▸ [$label] attempt $attempt/$RETRIES: $*" >&2
  set +e
  "$@"
  code=$?
  set -e

  if [ "$code" -eq 0 ]; then
    [ "$attempt" -gt 1 ] && echo "✓ [$label] succeeded on attempt $attempt" >&2
    exit 0
  fi

  # Should we retry this exit code?
  retryable=1
  if [ -n "$RETRY_ON_EXIT" ]; then
    retryable=0
    IFS=',' read -ra codes <<< "$RETRY_ON_EXIT"
    for c in "${codes[@]}"; do
      [ "$code" = "$c" ] && retryable=1 && break
    done
  fi

  if [ "$attempt" -ge "$RETRIES" ] || [ "$retryable" -ne 1 ]; then
    echo "::error::[$label] failed after $attempt attempt(s), exit=$code"
    exit "$code"
  fi

  # Exponential backoff with jitter (0-2s)
  delay=$(( BASE_DELAY * (2 ** (attempt - 1)) ))
  [ "$delay" -gt "$MAX_DELAY" ] && delay="$MAX_DELAY"
  jitter=$(( RANDOM % 3 ))
  sleep_for=$(( delay + jitter ))

  echo "::warning::[$label] attempt $attempt failed (exit=$code). Retrying in ${sleep_for}s…"
  sleep "$sleep_for"
  attempt=$(( attempt + 1 ))
done
