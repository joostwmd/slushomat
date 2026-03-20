# UI spec: Operator machine lifecycle (`operator-machine-lifecycle`)

## Placement

- **Operator:** under `/_protected/$orgSlug/…` (exact path names TBD in plan; e.g. `/businesses`, `/machines` or `/fleet`).
- **Admin:** extend existing admin navigation (e.g. near **Machines** / **Customers**) with sections for cross-org lifecycle management.

## Shared UI (`@slushomat/ui` composite)

- **Business entity** — shared **form** (name, legal name, legal form, VAT, address, country default DE) and **list/table** row actions (edit, soft-delete). Used by:
  - **Operator:** org-scoped list + create/edit.
  - **Admin:** org picker (or org context) then same form/list for that org.
- Keep app-specific wiring (tRPC, org slug, admin org selection) in each app.

## Admin flows

### Business entities (any org)

- Select **organization** (searchable list or existing customer/org picker pattern).
- List entities for that org; create / edit / archive using **shared** business-entity UI.

### Contracts

- **List** with filters: org, machine id, business entity, status.
- **Create:** pick **organization** → **business entity** (that org) → **machine** from **global machine catalog** → initial version fields (status default draft, dates, rent, **revenue share as basis points** with UX that shows **%** for humans, e.g. 15% ↔ 1500 bp), notes) + optional PDF upload (**same upload/signed-URL/confirm pattern** as existing admin asset flows).
- **Edit:** mutates versioned data (new version row as per API); PDF replace same pattern.
- **Status transitions:** explicit actions (e.g. Activate, Terminate) with confirm dialogs and validation messaging from server.

### Deployments

- **Start:** pick machine → pick **business entity** (must belong to chosen org, or flow that sets org from entity) → confirm; show error if machine already has open deployment.
- **End:** pick open deployment or machine with open deployment → confirm end date/time.

## Operator flows

### Business entities

- List / create / edit / archive for **current URL org** only; **shared** composite.

### Contracts (read-only)

- **Per-machine** or **org-wide list** of contracts for machines tied to this org (implementation choice in plan).
- Show **all statuses** including **terminated**; version history or timeline if API exposes it (nice-to-have: collapsed “history” per contract).
- **Download / view PDF** via same signed-URL pattern as admin (read-only for operator).

### Slot configuration

- Entry from **machine** or **fleet** context: only when machine has **current deployment**; show **left / middle / right** with product picker (`operator_product` for this org).
- Empty slot state; validation errors if product not in org.

## States & errors

- Machine **no open deployment:** operator slot UI hidden or disabled with explanation (“No active deployment — contact support”).
- Machine **no contract:** allowed; operator sees empty contract list or “No contract on file” for that machine.
- Admin: prevent **second active** contract per machine (server error surfaced inline).

## Open UX (minor — plan phase)

- Exact route names and nav labels (`Fleet` vs `Machines` vs `Businesses`).
- Whether operator contract list is **per machine** only or also a global **Contracts** tab under org.
