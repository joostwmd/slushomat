# Requirements: Invoices

## Summary

**Invoices** formalize billing **per business entity** within an organization. Each invoice:

- Has a **name** (display title / label).
- Breaks **cost** into **rent** and **revenue share** (amounts derived server-side from **active operator contracts** and **purchase events**).
- Stores an **admin-uploaded PDF** (canonical document for the operator; not system-generated from the breakdown alone unless product adds that later).

**Scope rule:** An invoice applies to **all machines** linked to that business entity through **active contracts** (machine ↔ business entity). It is **one invoice per business entity** for a given billing context — **not** one PDF/invoice per machine.

**Admin:** Global **Invoices** page (pattern similar to **Contracts**): list all invoices, add new (org → business entity → breakdown + PDF upload).

**Operator:** In **Documents** (sidebar), use **Shadcn Tabs** to switch between **Contracts** and **Invoices**; operators only see invoices for the **active** organization.

## Actors

| Actor | Capabilities |
|-------|----------------|
| **Admin** | List/create invoices; upload PDF; trigger server calculation from contracts + purchases. |
| **Operator** | List and open/download invoice PDF for their org (read-only). |

## Domain alignment

- **Operator contract** (`operator_contract`): links `machineId` + `businessEntityId` under `organizationId`; version carries `monthlyRentInCents`, `revenueShareBasisPoints`, `status` (draft / active / terminated).
- **Purchase** (`purchase`): `organizationId`, `machineId`, `businessEntityId`, `amountInCents`, `purchasedAt`, product/slot metadata.
- **Invoice** is keyed by **organization** + **business entity** (+ metadata below), not by a single machine.

## Functional requirements

### FR1 — Invoice record

Persist at least:

- `organizationId`
- `businessEntityId`
- **Name** (string, required)
- **Rent total** (integer cents, server-computed at creation)
- **Revenue share total** (integer cents, server-computed at creation)
- **PDF** storage reference (`pdfBucket`, `pdfObjectPath` or equivalent — same pattern as contract PDFs / product images)
- **Billing period** (see open points): e.g. `periodStart`, `periodEnd` inclusive, or single `billingMonth` — **must** be defined so calculations are reproducible
- `createdAt`, `createdBy` (admin user id if available)
- Optional: human-facing invoice number (auto) — **deferred** unless needed for support; can use id + dates in UI v1

### FR2 — Server calculation (on create)

When an admin submits a new invoice (org + business entity + period inputs + PDF):

1. Load all **active** operator contracts for that **`organizationId`** and **`businessEntityId`** (current active version, `status === active`, effective for the chosen period — see open points for overlap rules).
2. Collect the set of **machine IDs** from those contracts.
3. **Rent component:** Aggregate **monthly rent** from those contracts for the billing period (see open points: full months vs proration).
4. **Revenue share component:** From **purchase events** in that period, include purchases whose **machine** is in that set and whose **`businessEntityId`** matches the invoice’s business entity (and `organizationId` matches). For each qualifying purchase, apply the **revenue share basis points** of the **active contract** that links that machine to that business entity at purchase time (or at period — **default:** use contract terms active for that machine+entity during the period; document edge cases in test spec).

Persist computed cents on the invoice row; reject create if no active contracts exist for that entity (clear error).

### FR3 — PDF upload

- Admin uploads **one PDF** via **Dice UI** file dropzone (same registry pattern as admin products: `@diceui/file-upload`).
- Validate type/size consistent with existing storage rules (PDF-only, max size TBD — align with contract PDF limit, e.g. 10 MB, unless changed).
- Upload to Supabase Storage; store bucket + object path on invoice.

### FR4 — Admin UI

- New route **`/_admin/invoices`** (or `/invoices` under admin layout), listed in admin sidebar next to Contracts (same information architecture).
- **List** all invoices with filters comparable to contracts where useful (organization, business entity, date).
- **Create flow:** select **organization** → select **business entity** (scoped to that org) → set **invoice name** → define **billing period** (fields per open points) → show **computed rent / revenue share** (preview before save or computed on submit — UX in `01-ui-spec.md`) → **PDF dropzone** → submit.

### FR5 — Operator UI

- Rename or repurpose nav: **“Contracts”** becomes **“Documents”** (or add **Documents** that replaces the contracts entry — exact label in UI spec).
- Single org-scoped route (e.g. `/$orgSlug/documents`) with **Shadcn `Tabs`**: tab **Contracts** (existing contracts UI / behavior), tab **Invoices** (list + open PDF via signed URL, same pattern as contract PDF).
- Deep links: preserve ability to open contracts from machines if today’s URLs use `/contracts?machineId=` — either keep query on documents route or redirect (UI spec).

### FR6 — Authorization

- Admin procedures: full CRUD/list as designed.
- Operator procedures: list/get/download only for invoices where `organizationId` matches session’s active org; same conventions as `operator.operatorContract`.

## Non-goals (v1)

- Auto-generating PDF from breakdown (PDF is uploaded).
- Email delivery of invoices.
- Operator editing invoices.
- Per-machine invoice rows as separate billable artifacts (aggregation is per business entity).

## Acceptance criteria

### Admin

**Given** an admin selects org O, business entity E, valid period, name, and PDF  
**When** active contracts exist for E under O and calculation runs  
**Then** an invoice is stored with correct `organizationId`, `businessEntityId`, name, rent cents, revenue share cents, and PDF path, and appears on the global invoices list.

**Given** no active contracts for E under O  
**When** the admin attempts to create an invoice  
**Then** creation fails with a clear validation error (no orphan invoice).

### Operator

**Given** an operator in org O  
**When** they open Documents → Invoices  
**Then** they see only invoices for O and can download PDFs they are allowed to access.

**Given** an operator in org O  
**When** they attempt to access another org’s invoice id  
**Then** the API denies access.

## Open points (product / engineering)

1. **Billing period UI:** Calendar month picker vs explicit `startDate`/`endDate`. Affects rent proration and purchase `purchasedAt` filter.
2. **Rent for partial months:** Full month per active contract, prorate by days, or admin-entered override (user asked for calculation — default: **full calendar months** count once per contract per month in range, or **sum of monthlyRent × number of months** in range — **decide in implementation** and document in test spec).
3. **Contract effective overlap:** If a machine had two versions in one month, use version active at **period end** or split — specify in calculation docstring/tests.
4. **Tabs primitive:** Add Shadcn **Tabs** to `@slushomat/ui` if not already present.

## Resolved decisions

| Topic | Decision |
|-------|----------|
| Invoice granularity | **Per business entity**; all machines under active contracts for that entity. |
| Cost breakdown | **Rent** + **revenue share** only (cents); computed server-side. |
| PDF | **Admin-uploaded** PDF attached to invoice; operators download signed URL. |
| Admin entry | Global **Invoices** page; create similar to contracts listing + flow. |
| Create flow | **Org** → **business entity** → name + period + calculation + **Dice UI** PDF upload. |
| Data sources | **Active contracts** for entity + **purchase events** for revenue share. |
| Operator nav | **Documents** with **Shadcn Tabs**: Contracts \| Invoices. |
