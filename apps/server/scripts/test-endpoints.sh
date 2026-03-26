#!/usr/bin/env bash
# Hit API server machine routes. Run the server first (e.g. pnpm dev:server).
#
# Credentials: source test-endpoints.local.env (gitignored) or pass via env.
# Optional env:
#   API_SERVER_URL    Base URL (default: https://api.slushomat.localhost:1355 for portless)
#   CURL_TLS_INSECURE Set to 1 for curl -k (default: 1 for HTTPS self-signed certs)
#   MACHINE_API_KEY   Full SLUSH_… secret (sent as X-Machine-Key)
#   MACHINE_ID        UUID (sent as X-Machine-Id; must match key metadata and DB)
#
# Examples:
#   ./scripts/test-endpoints.sh
#   MACHINE_API_KEY='SLUSH_...' MACHINE_ID='uuid-here' ./scripts/test-endpoints.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/test-endpoints.local.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/test-endpoints.local.env"
  set +a
fi

BASE_URL="${API_SERVER_URL:-https://api.slushomat.localhost:1355}"
BASE_URL="${BASE_URL%/}"

CURL_OPTS=(-sS -i)
if [[ "${CURL_TLS_INSECURE:-1}" == "1" ]]; then
  CURL_OPTS+=(-k)
fi

echo "=== GET ${BASE_URL}/healthz (no auth)"
curl "${CURL_OPTS[@]}" "${BASE_URL}/healthz"
echo
echo

if [[ -n "${MACHINE_API_KEY:-}" && -n "${MACHINE_ID:-}" ]]; then
  echo "=== GET ${BASE_URL}/api/machine/products"
  echo "    X-Machine-Key: ***  X-Machine-Id: ${MACHINE_ID}"
  curl "${CURL_OPTS[@]}" -X GET \
    -H "X-Machine-Key: ${MACHINE_API_KEY}" \
    -H "X-Machine-Id: ${MACHINE_ID}" \
    "${BASE_URL}/api/machine/products"
  echo
  echo
  echo "=== POST ${BASE_URL}/api/machine/purchase (minimal body, expect 400 or 422)"
  echo "    X-Machine-Key: ***  X-Machine-Id: ${MACHINE_ID}"
  curl "${CURL_OPTS[@]}" -X POST -H "Content-Type: application/json" \
    -H "X-Machine-Key: ${MACHINE_API_KEY}" \
    -H "X-Machine-Id: ${MACHINE_ID}" \
    -d '{"operatorProductId":"invalid","slot":"left","amountInCents":100}' \
    "${BASE_URL}/api/machine/purchase"
  echo
else
  echo "=== Skipped /api/machine/purchase (set MACHINE_API_KEY and MACHINE_ID to test)"
  echo "=== Expect 401 without credentials (GET products):"
  curl "${CURL_OPTS[@]}" -X GET "${BASE_URL}/api/machine/products"
  echo
  echo "=== Expect 401 without credentials (POST purchase):"
  curl "${CURL_OPTS[@]}" -X POST -H "Content-Type: application/json" \
    -d '{}' "${BASE_URL}/api/machine/purchase"
  echo
fi
