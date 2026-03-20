# Test spec: Operator machine lifecycle (`operator-machine-lifecycle`)

## Unit

- Optional: pure helpers (e.g. slot enum validation, date rules) if extracted.

## Integration (primary)

| ID | Behaviour |
|----|-----------|
| I-1 | **Operator** business entity CRUD: scoped to org; cannot read/write another org’s entities |
| I-2 | **Admin** business entity CRUD: can target any org; cannot impersonate operator session incorrectly |
| I-3 | **Admin** contract create: anchors org + entity + machine from global catalog; version row created |
| I-4 | **Admin** contract update / status transition: new version or audit as designed; reject second **active** contract for same machine |
| I-5 | **Operator** contract list/get: only contracts for machines belonging to their org; includes **terminated** |
| I-6 | **Operator** cannot mutate contracts (mutations return forbidden) |
| I-7 | **Admin** deployment start/end: at most one open deployment per machine; end clears open row |
| I-8 | **Operator** cannot start/end deployments |
| I-9 | **Operator** slot update: only for current deployment; `operator_product` must match org; invalid slot rejected |
| I-10 | Contract PDF upload flow: same integration pattern as existing admin storage (signed URL + confirm) |

## E2E (optional v1)

- Smoke: admin creates entity + contract + deployment; operator sees contract read-only and sets three slots.

## Non-goals (v1)

- Full UI coverage of every admin filter combination.
