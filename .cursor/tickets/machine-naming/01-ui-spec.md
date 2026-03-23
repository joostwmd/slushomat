# UI spec: Machine naming (`machine-naming`)

## Admin — global machines (`/machines`)

- Table: columns **Id**, **Internal name**, **Version**, **Comments**, **Status**, actions.
- Sheet (create/edit): required **Internal name** text input; **Machine version** via `Select`; comments textarea unchanged.

## Admin — deployments (`/deployments`)

- **Organization**, **Business entity**, **Machine** fields use `Select`; machine options show `internalName` (fallback short id) + version.
- Open deployments table: **Machine** column shows internal name when known.

## Admin — contracts (`/contracts`)

- Filters: Organization and Status use `Select`.
- Create sheet: Organization, Business entity, Machine, Status use `Select`; machine option line: `internalName · v{version}` (fallback id prefix).
- Results table **Machine** column: three lines — internal name (bold), `Operator: {orgDisplayName}`, monospace short id.

## Admin — customer detail (`/customers/:id`)

- **Machines** tab: first column **Names** — org display name (title), internal name, short id.
- Purchases: machine filter options `orgDisplayName (internalName|shortId)`; purchase rows use `machineLabel` from API.

## Admin — customer machine detail & global machine detail

- Title prefers **org display name**, then internal name / short id.
- Subline: internal name and operator org name when in customer context; full id in small mono.

## Operator — machines list & purchases shortcuts

- Cards: **org display name** as title; optional “Internal: …” in description if set.

## Operator — machine detail

- H1: org display name; model line; optional internal name line; full id in small mono.
- Section **Name in your organization**: single text field + **Save name** (calls `setOrgDisplayName`).
- Slot configuration: product per slot via `Select` (empty option + products).

## Shared component

- `@slushomat/ui/base/select` — `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectLabel`, `SelectGroup`, `SelectSeparator` (Base UI Select primitives + shadcn-like styling).
