# UI spec: Machine API keys (`machine-api-keys`)

## Scope

**Admin app only**: create / rotate / revoke machine keys. Operators do not manage keys in v1.

## Better Auth constraints (UI)

- **Create / rotate** responses include the **full `key` once** — same as Better Auth `createApiKey` result ([docs](https://www.better-auth.com/docs/plugins/api-key)).
- **`getApiKey` / list** return **no full secret** — only metadata, name, **`start`** (leading characters, if `startingCharactersConfig` stores them), prefix, etc.

**Resolved:** **OQ-1 A** — After dismiss, show **“SLUSH_…****”**-style identification using **`start`** + prefix, plus **“Rotate key”** if the secret was lost. Do **not** promise “copy full key later.”

## Surfaces

### 1. Machine detail / edit

- **Generate API key** — when no key linked for this machine.
- **Rotate API key** — when a key exists; confirm that the **old secret stops working immediately**; show **new** full key once in modal.
- **Revoke** — remove/disable key per API; machine server rejects thereafter.

### 2. One-time full secret modal (create / rotate)

- Copy: “Copy this now.”
- **Copy** button; monospace field.
- Show **machine id** for device config alongside the secret.

### 3. Persistent “key identity” row (no full secret)

- Label: e.g. “Device API key”
- Show **prefix** + masked **`start`** (if available from API), created/updated time, enabled state.
- Actions: **Rotate**, **Revoke**.

### 4. Errors & permissions

- Reuse admin guards; surface API errors from Better Auth / tRPC as toasts or inline messages.

### 5. Accessibility

- Label secret region; named **Copy** control; focus management on dialogs.

## Out of scope (v1)

- QR pairing.
- Full-key “reveal” after initial create (not supported by Better Auth without custom vault).
