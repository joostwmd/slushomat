# Requirements: Machine API keys (`machine-api-keys`)

## Summary

Machine credentials are **Better Auth API keys** ([API Key plugin](https://www.better-auth.com/docs/plugins/api-key), package `@better-auth/api-key`): generated with prefix **`SLUSH_`** (Better Auth recommends a trailing underscore for readability). The physical device stores **machine id** + **secret key**. The **machine server** (`apps/machine-server`) authenticates each request by verifying the key (via Better Auth) and ensuring the **machine row is active** (`disabled = false`).

This ticket **implements** the credential binding called out as a non-goal in `machines-admin` v1.

### Documentation source

Context7 was unavailable (quota); requirements below are aligned with the official Better Auth docs: [API Key plugin](https://www.better-auth.com/docs/plugins/api-key), [Advanced](https://www.better-auth.com/docs/plugins/api-key/advanced), [Reference / schema](https://www.better-auth.com/docs/plugins/api-key/reference).

## Context (existing code)

- Machine server middleware stub used `X-Machine-Id` + `X-Machine-Key` and commented DB checks (`apps/machine-server/src/middleware/machine-auth.ts`).
- `machine` table: `id`, `machineVersionId`, `comments`, timestamps — **no `disabled` or key linkage yet**.
- Better Auth `apikey` table (after plugin migrate/generate) stores **hashed** secrets; optional **`start`** (leading characters) for UI identification ([`startingCharactersConfig`](https://www.better-auth.com/docs/plugins/api-key/reference)).

## Resolved decisions (from product / discovery)

| Topic | Decision |
|--------|-----------|
| Key system | **Better Auth API Key plugin** (`apiKey()` + DB migration). |
| Prefix | **`SLUSH_`** (`defaultPrefix` / `prefix` on create; matches doc recommendation for `prefix_`). |
| Who may create | **Admins only** (e.g. `adminProcedure` calling `auth.api.createApiKey` server-side with session headers or explicit admin checks). |
| Machine disabled | **`disabled boolean` on `machine`**. Use case: customer stops paying → disable device without deleting the row. |
| Fast auth path | After `verifyApiKey`, load **`machine` by id** (or by linked `apiKeyId`) and check **`disabled`** in one indexed lookup. |
| Customer / org later | **Billing / assignment** can live in a **future join table** (`machine` ↔ customer org). **Operational kill switch** stays on **`machine.disabled`** so the machine-server check stays a simple, fast predicate; sync that flag from billing workflows when the join exists. |
| Transport | **HTTPS** in production. |
| Automated test | **Integration test**: real **machine id** + **plaintext key**, hit machine-server (or shared verify path), assert DB-backed validity and **403/appropriate code** when disabled. |
| Full secret after create | **A** — Show full key only on **create/rotate**; afterward UI shows **prefix + `start`** only; **rotate** if the secret was lost ([Better Auth `getApiKey` omits secret](https://www.better-auth.com/docs/plugins/api-key)). |
| API key `referenceId` (v1) | **`references: "user"`** with **`userId` = the authenticated admin’s Better Auth user id** at create/rotate time. See **“Why referenceId exists”** below. |

## Why `referenceId` exists (plain English)

Better Auth’s API key table is built for keys that belong to a **person** (`user`) or a **team** (`organization`). Every row has a **`referenceId`**: “this key is owned by user X” or “org Y.”

Your device is **not** a Better Auth user. So you still pick **some** user or org id to satisfy the plugin — a **bucket** all machine keys hang off. That bucket does **not** replace `machineId`; it’s only for the plugin’s ownership model. The **real** link to the slush machine is **`metadata.machineId`** (and optionally **`machine.apiKeyId`**).

**Options (same product, different bucket):**

| Option | What you do | When it fits |
|--------|-------------|----------------|
| **(1) Internal org** | Create **one** org in Better Auth, e.g. “Slushomat machine keys”. Every `createApiKey` uses `organizationId: <that org id>` and `references: "organization"` for the machine `configId`. | **v1 default** — clear, audit-friendly (“all device keys belong to this internal org”). |
| **(2) Service / bucket user** | Create **one** user; every key uses `userId: <that user id>`. | All keys share one owner; good if you don’t want issuer baked into `referenceId`. |
| **(2b) Authenticated admin user id** | Each `createApiKey` passes **`userId: session.user.id`** (the admin performing the action). | **Yes, this is valid.** Gives an **audit trail** (who issued the key). Keys are still bound to the real device via **`metadata.machineId`** / **`machine.apiKeyId`**. |
| **(3) Customer org per tenant** | Key’s `referenceId` is the **customer’s** org; metadata still has `machineId`. | **Later**, when machines are tied to paying orgs. |

**v1 choice for this ticket:** **(2b) — `userId` = authenticated admin** (not a separate internal org). **Implementation note:** Admin UI and procedures must resolve “key for this machine” via **`machine.apiKeyId`** and/or **server-side queries** filtered by `configId` + `metadata.machineId`, not only Better Auth’s **“keys for the current session user”** list — otherwise another admin might not see keys created by someone else.

**Alternative:** If you prefer every machine key to show the **same** `referenceId`, use **(2)** with one designated user id instead of the per-request admin id.

## HTTP auth shape (best practice)

Use **`Authorization: Bearer <api-key>`** for the secret. This matches common practice for opaque tokens, plays well with proxies and clients, and matches Better Auth’s mental model (API key as bearer secret; plugin default header is `x-api-key` but is [configurable](https://www.better-auth.com/docs/plugins/api-key/reference) via `apiKeyHeaders` or `customAPIKeyGetter` to read the Bearer token).

Also send **`X-Machine-Id`** (machine primary key). The server must **bind** key → machine:

1. Verify bearer secret with **`auth.api.verifyApiKey`** (with a dedicated **`configId`** for machine keys, e.g. `"machine"`).
2. From the returned key record (no secret), read **`metadata.machineId`** (or follow FK `machine.apiKeyId` → ensure row id matches `X-Machine-Id`).
3. If mismatch → **401** (treat as invalid credentials: wrong pairing).
4. Load `machine` by id; if **`disabled`** → **403** (`MACHINE_DISABLED`).

This avoids accepting a valid key that was issued for a different machine if someone replays headers incorrectly.

## Acceptance criteria

1. **AC-1 — Plugin & schema**  
   Better Auth is configured with **`apiKey`** using at least one **`configId`** dedicated to machine devices (e.g. `machine`), **`enableMetadata: true`**, **`defaultPrefix: "SLUSH_"`**, and migrations applied so the **`apikey`** table exists in the app database.

2. **AC-2 — One logical key per machine (v1)**  
   Each machine has at most **one** active Better Auth API key for that `configId`. Creating a new key **replaces** the previous one (delete old key or enforce uniqueness via `machine.apiKeyId` + rotation flow).

3. **AC-3 — Admin issuance**  
   Only **admin-authenticated** flows can **create / rotate / revoke** the machine key (server-side `auth.api.createApiKey` / `updateApiKey` / `deleteApiKey` as appropriate, with ownership rules satisfied for the plugin).

4. **AC-4 — Metadata binding**  
   Each machine key stores **`machineId`** in API key **metadata** (and/or a **FK** from `machine` → `apikey.id` for listing and joins — implementation detail in plan).

5. **AC-5 — Machine server middleware**  
   Middleware reads **Bearer** token + **`X-Machine-Id`**, runs **verifyApiKey** + **machine `disabled` check**; **401** invalid pairing or bad key; **403** disabled machine; success attaches **machine id** (and minimal context) for handlers.

6. **AC-6 — Integration test**  
   Test creates a machine + API key (via test harness / admin API / direct `createApiKey` in setup), then calls machine-server with **real id + key**, asserts **200** on a protected route; with **`disabled: true`**, asserts **403** (or agreed error contract).

7. **AC-7 — No plaintext key in DB**  
   Rely on plugin defaults: **hashed** storage in `apikey.key`; do **not** enable `disableKeyHashing` except in local dev if ever needed (strongly discouraged per [docs](https://www.better-auth.com/docs/plugins/api-key/reference)).

## Non-goals (v1)

- Multiple concurrent active keys per machine (no overlap rotation window).
- Operator self-service key issuance.
- Storing full plaintext secrets in a custom column (rejected for v1; choice **A** for post-create UX).

## Open questions

_None — OQ-1 resolved (**A**); `referenceId` approach: **admin `userId` at issuance** (was internal org; superseded by product choice). Revisit option **(3)** when customer-org billing ties keys to tenant orgs._

## Branch / workflow

Implementation on a **feature branch** (not `main`).
