#!/usr/bin/env bash
# GET /api/machine/products for the authenticated machine. Run the API server first.
#
# Credentials: source test-endpoints.local.env (gitignored) or pass via env.
# Required: MACHINE_API_KEY, MACHINE_ID
# Optional env:
#   API_SERVER_URL    Base URL (default: https://api.slushomat.localhost:1355)
#   CURL_TLS_INSECURE Set to 1 for curl -k (default: 1 for HTTPS self-signed certs)
#
# Example:
#   ./scripts/fetch-machine-products.sh

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

if [[ -z "${MACHINE_API_KEY:-}" || -z "${MACHINE_ID:-}" ]]; then
  echo "Error: MACHINE_API_KEY and MACHINE_ID required. Set in test-endpoints.local.env or env."
  exit 1
fi

CURL_OPTS=(-sS)
if [[ "${CURL_TLS_INSECURE:-1}" == "1" ]]; then
  CURL_OPTS+=(-k)
fi

echo "=== GET ${BASE_URL}/api/machine/products"
echo "    X-Machine-Key: ***  X-Machine-Id: ${MACHINE_ID}"
echo

if command -v jq >/dev/null 2>&1; then
  curl "${CURL_OPTS[@]}" -X GET \
    -H "X-Machine-Key: ${MACHINE_API_KEY}" \
    -H "X-Machine-Id: ${MACHINE_ID}" \
    "${BASE_URL}/api/machine/products" | jq .
else
  curl "${CURL_OPTS[@]}" -X GET \
    -H "X-Machine-Key: ${MACHINE_API_KEY}" \
    -H "X-Machine-Id: ${MACHINE_ID}" \
    "${BASE_URL}/api/machine/products"
fi
echo
