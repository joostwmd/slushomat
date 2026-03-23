# Requirements: Machine naming (`machine-naming`)

## Feature slug

`machine-naming`

## Summary

Machines are identified by opaque IDs in many UIs. This feature adds:

1. **`internalName` (platform admin)** — Required on create/update in the global machine catalog. Used for internal / team mapping. Stored on `machine.internal_name`. Separate from `comments` (which stay for bug reports, customer issues, etc.).
2. **`orgDisplayName` (operator organization)** — Exactly one name per `(organizationId, machineId)`, shared by the whole org (standard vocabulary). Stored in `organization_machine_display_name`. **Required** in the data model; default when first needed: **`{Organization.name} machine`**. Duplicates allowed within an org; operators manage ambiguity.
3. **Admin visibility** — Admin surfaces show **internal name** and **operator org name** where both apply (e.g. customer machine list, contract list, machine detail when scoped to a customer).
4. **Operator visibility** — Operator UIs use **org display name** as the primary label; internal name may appear as secondary context. Operators can **rename** org display name via `operator.machine.setOrgDisplayName`.

## Data model

| Store | Key | Field |
|-------|-----|--------|
| `machine` | `id` | `internal_name` text NOT NULL default `''` (API requires non-empty on create/update) |
| `organization_machine_display_name` | `(organization_id, machine_id)` | `org_display_name` text NOT NULL |

## Behaviour

- **Contract create** — After inserting an operator contract, ensure a display-name row exists for that org + machine (default `{org name} machine` if missing).
- **Operator machine list / get** — Ensures display names exist for all machines under contract for that org, then returns `internalName` + `orgDisplayName`.
- **Purchases** — List responses include `machineLabel` = `coalesce(orgDisplayName, internalName, machineId)` after ensuring org machines where applicable.

## UI

- Machine **dropdowns** and **cards** use names (internal and/or org) instead of raw IDs where listed in scope.
- **Select controls** — Use the shared `@slushomat/ui/base/select` (Base UI–based, shadcn-style) instead of native `<select>` on the surfaces touched for this feature (contracts, deployments, admin machines version picker, purchases filters, operator slot product picker).

## Non-goals

- Uniqueness of names (explicitly not required).
- Changing machine IDs, API keys, or purchase recording semantics.

## Acceptance criteria

- [x] Admin can set required **internal name** on machine create/edit; it appears on admin machine list and machine dropdowns.
- [x] Org display name defaults to `{Org name} machine` when a contract links machine + org; operators can update it; admin sees both names on customer machine views and contract list.
- [x] Operator machine cards and detail use org name as primary title; purchases table/filter use human-readable machine labels.
- [x] Comments remain independent bug/support notes.
- [x] Native `<select>` replaced with design-system Select on agreed surfaces.

## Open questions

_None — resolved._
