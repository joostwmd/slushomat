#!/usr/bin/env bash
# Hit machine-server routes. Run the server first (e.g. pnpm dev:machine or dev:local).
#
# Optional env:
#   MACHINE_SERVER_URL   Base URL (default: http://localhost:3004)
#   CURL_TLS_INSECURE    Set to 1 to pass curl -k (local HTTPS / self-signed)
#   MACHINE_API_KEY      Full SLUSH_… secret (sent as X-Machine-Key)
#   MACHINE_ID           UUID (sent as X-Machine-Id; must match key metadata and DB)
#
# Examples:
#   ./scripts/test-endpoints.sh
#   MACHINE_API_KEY='SLUSH_...' MACHINE_ID='uuid-here' ./scripts/test-endpoints.sh
#   MACHINE_SERVER_URL=https://machine.slushomat.localhost:1355 CURL_TLS_INSECURE=1 ./scripts/test-endpoints.sh

set -euo pipefail

BASE_URL="${MACHINE_SERVER_URL:-http://localhost:3004}"
BASE_URL="${BASE_URL%/}"

CURL_OPTS=(-sS -i)
if [[ "${CURL_TLS_INSECURE:-}" == "1" ]]; then
  CURL_OPTS+=(-k)
fi

echo "=== GET ${BASE_URL}/healthz (no auth)"
curl "${CURL_OPTS[@]}" "${BASE_URL}/healthz"
echo
echo

if [[ -n "${MACHINE_API_KEY:-}" && -n "${MACHINE_ID:-}" ]]; then
  echo "=== GET ${BASE_URL}/is-killed"
  echo "    X-Machine-Key: ***  X-Machine-Id: ${MACHINE_ID}"
  curl "${CURL_OPTS[@]}" \
    -H "X-Machine-Key: ${MACHINE_API_KEY}" \
    -H "X-Machine-Id: ${MACHINE_ID}" \
    "${BASE_URL}/is-killed"
  echo
else
  echo "=== Skipped /is-killed (set MACHINE_API_KEY and MACHINE_ID to test protected route)"
  echo "=== Expect 401 without credentials:"
  curl "${CURL_OPTS[@]}" "${BASE_URL}/is-killed"
  echo
fi
