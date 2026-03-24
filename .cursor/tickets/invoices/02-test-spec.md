# Test spec: Invoices

Classification follows project conventions: **integration tests** for tRPC + auth boundaries; **E2E** for critical cross-app flows optional; **unit** only for pure calculation helpers if extracted.

## Unit (optional)

- **Pure function** (if extracted from router): given a set of active contract rows (machineId, monthlyRentInCents, revenueShareBasisPoints, effective/ended) and a list of purchases (machineId, businessEntityId, amountInCents, purchasedAt), return `{ rentCents, revenueShareCents }` for a fixed period.
  - Cases: empty contracts → error or zero rent with no purchases; single machine; multiple machines same entity; purchases outside period excluded; purchases wrong `businessEntityId` excluded; revenue share rounding (document rule: integer cents per purchase vs aggregate then round).

## Integration — Admin (`adminProcedure`)

| ID | Behavior |
|----|----------|
| A1 | **Create invoice** with org + entity + period + amounts persisted + PDF path: success; row exists in DB. |
| A2 | **Create** with **no active contracts** for entity: fails with defined TRPC error code / message. |
| A3 | **List** returns invoices across orgs; filter by `organizationId` narrows. |
| A4 | **List** filter by `businessEntityId` when org selected. |
| A5 | Non-admin cannot call admin invoice procedures (use existing procedure tests pattern). |

## Integration — Operator (`operator` session)

| ID | Behavior |
|----|----------|
| O1 | **List** for org O returns only invoices with `organizationId === O`. |
| O2 | **Get** / **signed download URL** for invoice in O succeeds. |
| O3 | **Get** invoice belonging to another org: forbidden or not found. |

## Integration — Calculation correctness

| ID | Behavior |
|----|----------|
| C1 | One **active** contract (machine M, entity E, rent R, share S bp), purchases only on M for E in period: rent matches agreed rule; revenue share = sum(floor(amount * S / 10000)) or documented rule. |
| C2 | Two machines under same E: rent aggregates both contracts; purchases on both machines included. |
| C3 | Purchase on machine **not** under active contract for E: excluded from revenue share. |
| C4 | **Terminated** contract before period: not included; **active** during period: included per effective/ended rules. |

## E2E (Playwright) — optional / smoke

| ID | Behavior |
|----|----------|
| E1 | Admin: open Invoices → start create → select org + entity → see preview amounts → upload PDF → submit → row visible in list. |
| E2 | Operator: open Documents → Invoices tab → see invoice → download control triggers (or opens URL). |

## Test data setup

- Reuse patterns: `createUser` → org → business entity → machines → operator contracts (active versions) → purchases with `businessEntityId` and dates inside/outside period.
- Cleanup after each integration test.

## Out of scope for automated tests (manual)

- Dice UI drag-drop UX (E2E can use file input if exposed).
- Exact PDF binary content.
