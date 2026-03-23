# Test spec: Machine naming (`machine-naming`)

## Unit (optional / future)

- `defaultOrgMachineDisplayName` / trimming edge cases (empty org name → `"machine"`).

## Integration (tRPC + DB)

- **Admin `machine.create` / `machine.update`** — Rejects empty `internalName`; persists trimmed value; list/get return it.
- **`operatorContract.create`** — Creates `organization_machine_display_name` row with default `{org name} machine` when absent.
- **`operator.machine.list` / `get`** — After ensure, returns non-empty `orgDisplayName`; `setOrgDisplayName` updates row and survives refetch.
- **`admin.customer.listMachines`** — Returns `internalName` + `orgDisplayName` after ensure.
- **`admin.operatorContract.list`** — Includes `machineInternalName` and `machineOrgDisplayName` (nullable join).
- **`operator.purchase.list` / `admin.purchase.list`** — Each row includes `machineLabel` matching coalesce logic when joins present.

## E2E (optional / future)

- Admin creates machine with internal name → appears in contract machine dropdown.
- Operator opens machine → sees default org name → renames → list and purchases reflect new name.

## Manual smoke (current)

- `pnpm db:push` with new columns/table, then: create machine (internal name), create contract, open operator machines, rename org display name, verify admin customer machines tab shows both names.
