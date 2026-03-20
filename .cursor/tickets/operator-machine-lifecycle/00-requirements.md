# Requirements: Operator machine lifecycle (`operator-machine-lifecycle`)

## Feature slug

`operator-machine-lifecycle`

## Summary

Extend the platform beyond **admin-created machines** (`machines-admin`) so that:

1. **Operators** (Better Auth `organization` + `member`) can have **one or more business entities** (German legal entities: GmbH, etc.).
2. Each **machine** is linked to the platform ↔ operator relationship via a **versioned contract** anchored to **organization + business entity + machine** (immutable base); **conditions** (status, dates, monthly rent, **revenue share in basis points** 0–10000, PDF, notes) live in **contract versions** with full audit (`changes` table from model-factory).
3. **Operational placement** is tracked by **machine deployment** (temporal): machine ↔ business entity, `started_at` / `ended_at` (null = current). Independent of contract rows (draft contract can exist before physical deployment).
4. **Slot configuration** is scoped to the **active deployment**: three slots **`left` | `middle` | `right`**, each optionally bound to an **`operator_product`** (assumes `operator-products` schema is present).

This feature includes **database schema**, **tRPC API**, and **UI** (admin + operator) as agreed in discovery — not schema-only.

## Relationship to existing features

| Existing | This feature |
|----------|----------------|
| `machines-admin` | Machine + version catalog (global); unchanged responsibility for creating “bare” machines |
| `operator-products` | `operator_product` rows per org; slot config references these |
| `machine-api-keys` | Machine API keys remain separate concern |

## Actors

- **Platform admin:** full access to global machine catalog linkage, contracts, and cross-org visibility as specified below.
- **Operator user:** authenticated member of an organization; actions scoped to org + membership checks (URL org context + server verification).

## Data model (decided — DB)

### `business_entity` — `defineStaticEntity`, scope `org`, soft delete

- Fields: `name`, `legalName`, `legalForm` (e.g. GmbH/UG/AG), `vatId`, `street`, `city`, `postalCode`, `country` (default `DE`).
- **Not** versioned — updates are in-place on the static row.

### `operator_contract` — `defineVersionedEntity`, scope `org`

- **Base (immutable anchors):** `organisationId` (from scope), `businessEntityId`, `machineId`.
- **Versions (mutable):** `status` (`draft` | `active` | `terminated`), `effectiveDate`, `endedAt` (nullable), `monthlyRentInCents`, `revenueShareBasisPoints` (integer **0–10000**, e.g. `1500` = 15.00%), `pdfUrl` (nullable), `notes` (nullable).
- **Changes:** model-factory audit trail (actor, action).
- **Constraint:** A machine **may have zero** active contracts (e.g. in maintenance, in stash, not yet shipped to a customer). When a contract is **active**, at most **one** active contract per `machineId` — enforce via partial unique index (`WHERE status = 'active'`) or equivalent application validation.

### `machine_deployment` — plain Drizzle (temporal junction)

- `machineId`, `businessEntityId`, `startedAt`, `endedAt` (null = current).
- Partial unique: one open deployment per machine (`ended_at IS NULL`).

### `machine_slot_config` — plain Drizzle

- `machineDeploymentId`, `slot` enum **`left` | `middle` | `right`**, `operatorProductId` → `operator_product.id` (FK; feature assumed available).
- Unique `(machineDeploymentId, slot)`.
- **Current config only** — historical slot lineup is non-goal for v1 (admin “nice to have” later).

### Contract vs deployment

- **Independent:** no FK between `operator_contract` and `machine_deployment`. Resolve “contract for this deployment” by matching `machineId` + `businessEntityId` (and active status / dates as per product rules).

## Functional requirements

### FR-A — Business entities

- **Operators:** CRUD (create, list, edit, soft-delete) business entities for **their** organization only; server verifies membership + org scope.
- **Admins:** CRUD business entities **for any** organization (support / onboarding). Target org is selected in admin UI (e.g. org picker).
- **UI:** **Shared** composite components for business-entity forms and list/table patterns (`@slushomat/ui` or equivalent); admin and operator apps wire tRPC + navigation only.

### FR-B — Contracts (admin-owned lifecycle)

- **Admins only:** create, update (including new **version** rows as needed), upload/replace **PDF**, transition **status** (`draft` → `active` → `terminated`), list/filter across orgs/machines/entities.
- **Operators:** **read-only** access to contracts that belong to **their** org’s machines — including **draft**, **active**, and **terminated** (full history visible per machine or per org as specified in UI spec).
- **Machine selection (clarification):** There is **no** operator “claim machine with code/serial” flow in v1. When an admin creates or edits a contract, they choose **`machineId`** from the **global admin machine catalog** (same source as `machines-admin`). The contract base also anchors `organisationId` and `businessEntityId` (that org’s entity).

### FR-C — Machine deployment (admin-only)

- **Admins only:** start deployment (assign machine to a business entity; close any previous open deployment for that machine), end deployment (`ended_at`).
- Operators do **not** start/end deployments in v1.

### FR-D — Slot configuration

- For the **current** deployment of a machine, **operator** sets **left / middle / right** to an `operator_product` in the **same organization** as the URL/session context; verify membership and that the product’s `organization_id` matches.
- Clearing a slot is allowed (nullable product).
- **Admin slot override:** not required in v1 unless support needs arise (default: **operator-only** writes).

### FR-E — Admin vs operator UI entry points

- **Admin:** org/business-entity management (any org), global machine list integration, contract CRUD + PDF upload, deployment start/end, cross-org visibility.
- **Operator:** business entities under `/$orgSlug/…`, **read-only** contract views for their machines, **slot** editor for current deployment; no deployment or contract mutations.

### FR-F — Security

- All procedures: resolve org from **URL + input**, verify **membership** for operator routes; admin routes use `adminProcedure`.
- No RLS — app-layer enforcement only (stack norm).
- Cross-org access must be impossible for operator callers.

## Non-goals (v1)

- Historical slot configuration reporting (beyond current row per deployment).
- Automated billing/invoicing from `monthlyRentInCents` / revenue share (data capture only unless decided otherwise).
- In-app PDF generation for contracts (upload only).
- Operator “claim machine” / serial-code self-linking flows.

## Resolved decisions (discovery)

| Topic | Decision |
|-------|----------|
| **Slug** | `operator-machine-lifecycle` |
| **Business entities** | Admins **and** operators CRUD; **shared UI** for forms/lists |
| **Contracts** | **Admins** full CRUD + PDF upload + status; **operators** read-only, all statuses including **terminated** |
| **Deployments** | **Admins** only |
| **Machine ↔ contract** | Admin picks **`machineId`** from **global machine catalog**; no operator claim flow in v1 |
| **Active contract** | Machine **may have no** active contract; if any active exists, **at most one** active per machine |
| **Contract PDF** | Same **storage path / upload / signed URL** pattern as existing admin flows (e.g. template product images — align in implementation) |
| **Revenue share** | **`revenueShareBasisPoints`** integer **0–10000** (e.g. 1500 = 15.00%) |

## References

- Prior design discussion (this chat): static business entity, versioned contract with machine + entity on base, deployment + slot enum.
- **Model-factory:** `defineStaticEntity` / `defineVersionedEntity` live under **`packages/db/src/model-factory/`** (ported from the db-agent **model-factory** skill), not a separate workspace package. See [`03-plan.md`](./03-plan.md) §1.1 and ticket **T00**.
- `packages/db` schema: `machine`, `machine_version`, `organization`, `member`; `operator_product` when merged.
- Stack: Drizzle, tRPC, Better Auth org plugin, admin + operator frontends.
