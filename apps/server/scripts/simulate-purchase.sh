#!/usr/bin/env bash
# POST a purchase to API /api/machine/purchase. Run the API server first.
#
# Credentials: source test-endpoints.local.env (gitignored) or pass via env.
# Required: MACHINE_API_KEY, MACHINE_ID
# Optional env:
#   API_SERVER_URL       Base URL (default: https://api.slushomat.localhost:1355 for portless)
#   CURL_TLS_INSECURE    Set to 1 for curl -k (default: 1 for HTTPS self-signed certs)
#   OPERATOR_PRODUCT_ID  UUID (required — use a valid operator_product id from DB)
#   SLOT                 left|middle|right (default: left)
#   AMOUNT_CENTS         Positive integer (default: 100)
#
# Example:
#   ./scripts/simulate-purchase.sh
#   OPERATOR_PRODUCT_ID=uuid-here ./scripts/simulate-purchase.sh

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

SLOT="${SLOT:-left}"
AMOUNT_CENTS="${AMOUNT_CENTS:-100}"

if [[ -z "${MACHINE_API_KEY:-}" || -z "${MACHINE_ID:-}" ]]; then
  echo "Error: MACHINE_API_KEY and MACHINE_ID required. Set in test-endpoints.local.env or env."
  exit 1
fi

if [[ -z "${OPERATOR_PRODUCT_ID:-}" ]]; then
  echo "Error: OPERATOR_PRODUCT_ID required (UUID of an operator_product from DB)."
  exit 1
fi

CURL_OPTS=(-sS -i -X POST -H "Content-Type: application/json")
if [[ "${CURL_TLS_INSECURE:-1}" == "1" ]]; then
  CURL_OPTS+=(-k)
fi

BODY=$(jq -n \
  --arg op "${OPERATOR_PRODUCT_ID}" \
  --arg slot "${SLOT}" \
  --argjson amt "${AMOUNT_CENTS}" \
  '{operatorProductId: $op, slot: $slot, amountInCents: $amt}')

echo "=== POST ${BASE_URL}/api/machine/purchase"
echo "    X-Machine-Key: ***  X-Machine-Id: ${MACHINE_ID}"
echo "    Body: ${BODY}"
curl "${CURL_OPTS[@]}" \
  -H "X-Machine-Key: ${MACHINE_API_KEY}" \
  -H "X-Machine-Id: ${MACHINE_ID}" \
  -d "${BODY}" \
  "${BASE_URL}/api/machine/purchase"
echo
