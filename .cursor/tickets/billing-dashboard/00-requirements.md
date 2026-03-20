# Requirements: Billing Dashboard (`billing-dashboard`)

## Feature slug

`billing-dashboard`

## Summary

Extend both the **operator dashboard** and the **admin dashboard** with purchase tracking tables and customer management views. The physical slushomat machines record sales; this feature adds:

1. A `purchae` table — the canonical record of every transaction a machine completes.
2. A **machine-server endpoint** that creates purchase records at the point of sale (authenticated per-machine API key).
3. An **operator "Purchases" screen** — filterable table for the full org with CSV export, plus machine cards linking to per-machine purchase views.
4. An **admin "Customers" screen** — table of all operator organisations, searchable/filterable, with a "New Customer" action.
5. An **admin customer-detail view** (`/customers/:customerId`) — business entities, machines under contract, product gallery, and the org's purchase history.
6. An **admin machine-detail visew** (`/customers/:customerId/machines/:machineId`) — per-machine purchases, current slot configuration, active contract, and a "Configure Contract" button that pre-fills customerId + machineId in the existing contract form.

## Relationship to existing features

| Existing feature | Role in this feature |
|-----------------|----------------------|
| `operator-machine-lifecycle` | Supplies `business_entity`, `operator_contract` (base + versions), `machine_deployment`, `machine_slot_config`, `machine_slot` enum. **All must be merged before this feature lands.** |
| `operator-products` | `operator_product.priceInCents` / `taxRatePercent` referenced from purchase rows; product gallery reuses existing list API. |
| `machines-admin` | Global machine catalog; used in admin customer-detail machine list and admin machine-detail. |
| `admin-create-customer` | Existing `/create-customer` route; "New Customer" button on the customers page simply links here. |

## Actors

- **Machine** (authenticated via API key): creates purchase records.
- **Platform admin**: reads purchases for any organisation; views customer list and customer / machine detail.
- **Operator user**: reads purchases scoped to their organisation; applies time and entity filters; exports CSV.

## Data model

### `purchase` — new plain Drizzle table

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | `crypto.randomUUID()` |
| `machineId` | text NOT NULL → `machine.id` | On delete: restrict |
| `organizationId` | text NOT NULL → `organization.id` | Denormalised from active contract at write time |
| `businessEntityId` | text nullable → `business_entity.id` | From active deployment at write time; null if no open deployment |
| `operatorProductId` | text NOT NULL → `operator_product.id` | On delete: restrict |
| `slot` | `machine_slot` NOT NULL | Which dispenser slot was used |
| `amountInCents` | integer NOT NULL | Actual amount collected by the machine (= product `priceInCents` at time of sale) |
| `purchasedAt` | timestamp NOT NULL defaultNow | When the transaction occurred |
| `createdAt` | timestamp NOT NULL defaultNow | Row insertion time |

**Indexes:**
- `(organizationId, purchasedAt DESC)` — operator + admin org-scoped list queries
- `(machineId, purchasedAt DESC)` — per-machine list queries
- `(businessEntityId, purchasedAt DESC)` — entity-filter queries

**No versioning, no soft delete** — purchase rows are immutable audit records.

## Functional requirements

### FR-A — Machine server: record purchase

- `POST /purchase` (protected by `machineAuthMiddleware`).
- Input body: `{ operatorProductId, slot, amountInCents }` (Zod-validated).
- Server resolves `machineId` from Hono context (`c.get("machineId")`).
- Server resolves `organizationId` by finding the **active** `operator_contract` version for this machine (`status = 'active'`, current version).
- Server resolves `businessEntityId` from the open `machine_deployment` for this machine (`endedAt IS NULL`). If no open deployment: `businessEntityId = null`.
- **Guard:** If no active contract exists → respond `422 { code: "NO_ACTIVE_CONTRACT" }`. Cannot attribute purchase to an org without an active contract.
- On success: insert `purchase` row, return `201 { id, purchasedAt }`.

### FR-B — Admin: customer list

- `admin.customer.list` procedure — lists all organisations with:
  - `id`, `name`, `slug`
  - `machineCount` — count of `operator_contract` base rows whose **current version** has `status = 'active'` for this org (machines currently under active contract).
- Sortable / filterable by name; paginated (cursor or offset — implementation choice).
- UI shows a table; "New Customer" button links to existing `/_admin/create-customer`.

### FR-C — Admin: customer detail

- `admin.customer.get({ organizationId })` — returns org name + slug.
- Sections on the page (re-use existing sub-routers where possible):
  1. **Business entities** — use existing `admin.businessEntity.listByOrganization`.
  2. **Machines** — machines that have at least one `operator_contract` row (any status) for this org; show machine ID, version, current contract status.
  3. **Product gallery** — use existing operator-products list API scoped to org (admin call).
  4. **Purchases table** — `admin.purchase.list` filtered by `organizationId`, with date-range + entity filter.
- Admin can click a machine row → navigates to the machine-detail sub-route.

### FR-D — Admin: machine detail (under customer)

- Route: `/_admin/customers/$customerId/machines/$machineId`.
- Sections:
  1. **Purchases** — `admin.purchase.list` filtered to `machineId`.
  2. **Slot configuration** — current slot assignments (uses existing `operator.machineSlot.getConfigForMachine` or a new admin equivalent read; read-only display is sufficient for v1).
  3. **Contract** — current/latest operator contract for this machine (use existing `admin.operatorContract.list` filtered to machine).
  4. **"Configure Contract" button** — navigates to `/_admin/contracts` with query params `?organizationId=<customerId>&machineId=<machineId>` (pre-fills the existing contract create/edit form; no new form needed).

### FR-E — Operator: purchases page

- Route: `/_protected/$orgSlug/purchases`.
- Filterable table: date range (from/to), business entity (multi-select or single), machine ID.
- `operator.purchase.list({ orgSlug, machineId?, startDate?, endDate?, businessEntityId? })` — server enforces org membership; returns paginated rows.
- **Export CSV**: client-side; all currently-filtered rows → CSV → wrapped in a ZIP archive → downloaded to browser's default download folder. File name: `purchases-<orgSlug>-<date>.zip` containing `purchases.csv`. Uses `jszip` (or `fflate`) + browser `URL.createObjectURL`. PDF export is **out of scope for v1**.
- **Machine cards grid** below (or above) the table: one card per machine with an active contract for the org, showing machine ID + version; clicking navigates to `/$orgSlug/machines/$machineId/purchases`.

### FR-F — Operator: machine purchases page

- Route: `/_protected/$orgSlug/machines/$machineId/purchases`.
- Same purchase table component, pre-filtered to this machine; date-range filter still available.
- Breadcrumb / back link to `/$orgSlug/machines`.

### FR-G — Shared UI component

- `PurchasesTable` in `packages/ui/src/composite/` — pure presentational; receives `data: PurchaseRow[]`, `isLoading`, optional filter state + callbacks, optional export callback.
- **No tRPC inside** — data fetching stays in each app's route/page component.
- Column definitions: Date/Time, Machine ID, Slot, Product name, Amount (formatted EUR), Business Entity.
- Supports empty state and loading skeleton.

### FR-H — Security

- Machine server endpoint: protected by existing `machineAuthMiddleware`; no user session.
- `operator.purchase.list`: resolve org from `orgSlug`, assert membership (`assertUserMemberOfOrg`) before returning any rows.
- `admin.purchase.list`, `admin.customer.*`: `adminProcedure` only.
- Cross-org leakage must be impossible for operator callers.

## Non-goals (v1)

- PDF export (future sprint).
- Invoice generation or automated billing from purchase data.
- Real-time purchase feed / WebSocket updates.
- Admin slot-config mutations from machine-detail page (read-only in this feature).
- Pagination beyond simple cursor/offset in admin customer list.

## Resolved decisions

| Topic | Decision |
|-------|----------|
| **Slug** | `billing-dashboard` |
| **Purchase attribution** | `organizationId` from active contract (NOT NULL); `businessEntityId` from open deployment (nullable) |
| **No active contract guard** | Machine server rejects purchase with `422 NO_ACTIVE_CONTRACT` |
| **CSV export** | Client-side, JSZip/fflate, ZIP wrapper, browser download; no server-side generation in v1 |
| **Shared UI** | `PurchasesTable` in `packages/ui` — presentational only; hooks stay per-app |
| **"New Customer" button** | Links to existing `/_admin/create-customer` route (no new form) |
| **"Configure Contract" button** | Navigation to `/_admin/contracts` with query params `organizationId` + `machineId` pre-filled |
| **Admin machine-detail slots** | Read-only display; mutation is out of scope for this feature |

## References

- `operator-machine-lifecycle` plan + tickets (T00–T08) — prerequisite feature.
- `packages/db/src/schema/machine-lifecycle.ts` — `machineSlotEnum`, `machineDeployment`, `machineSlotConfig`.
- `packages/db/src/schema/operator-contract.ts` — `operatorContract` (base), `operatorContractVersion`.
- `packages/db/src/schema/operator-product.ts` — `operatorProduct.priceInCents`, `taxRatePercent`.
- `apps/machine-server/src/middleware/machine-auth.ts` — sets `c.get("machineId")`.
- Stack: Drizzle, Hono, tRPC, TanStack Router, Shadcn, TypeScript strict.
