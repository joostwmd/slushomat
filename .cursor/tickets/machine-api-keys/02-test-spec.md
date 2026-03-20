# Test spec: Machine API keys (`machine-api-keys`)

## Unit

- Prefer testing **small pure helpers** if any are extracted (e.g. parsing `Authorization: Bearer`, normalizing `X-Machine-Id`). **Do not** re-test Better Auth’s hashing/verify internals.

## Integration (required)

1. **Setup**  
   - Ensure DB has **`machine`**, **`apikey`** (Better Auth plugin), and **`disabled`** on `machine` as per migration.  
   - Create a **machine** row and a **machine API key** via the same path production uses (e.g. `auth.api.createApiKey` with `configId: "machine"`, metadata `machineId`, plus `machine.apiKeyId` update if that’s the chosen linkage).

2. **Happy path**  
   - HTTP request to **machine-server** with `Authorization: Bearer <plaintext key>` and `X-Machine-Id` matching metadata/FK.  
   - Expect **success** on a route protected by middleware (e.g. not `/healthz` if health stays public).

3. **Wrong pairing**  
   - Valid key for machine A + `X-Machine-Id` for machine B → **401** (invalid credentials).

4. **Disabled machine**  
   - Set `machine.disabled = true` → same valid key/id → **403** (or agreed `MACHINE_DISABLED` contract).

5. **Revoked / deleted key**  
   - After revoke/delete → **401**.

6. **Admin-only issuance** (if tested at tRPC layer)  
   - Non-admin cannot create keys for machines.

## E2E (optional)

- Admin UI: generate → see modal → dismiss → detail shows masked identity only (OQ-1 **A**).

## Security checks

- No procedure returns **full** `key` except create/rotate responses.  
- Logs must not print bearer tokens.
