# Test Spec: Billing Dashboard (`billing-dashboard`)

## Scope

Integration tests (PGlite pattern, same as `operator-machine-lifecycle`) covering the API boundaries. E2E (Playwright) is optional for v1.

---

## Integration tests

### I-1 — Machine server: record purchase (happy path)

**Layer:** machine-server Hono route  
**Preconditions:**
- Machine exists with a valid API key.
- Active `operator_contract` version for that machine (`status = 'active'`).
- Open `machine_deployment` for that machine (endedAt IS NULL).
- `operator_product` exists for the org.

**Steps:**
1. Authenticate with machine key (`X-Machine-Key`, `X-Machine-Id`).
2. `POST /purchase { operatorProductId, slot: "left", amountInCents: 350 }`.

**Assertions:**
- Response: `201 { id, purchasedAt }`.
- `purchase` row in DB with correct `machineId`, `organizationId` (from contract), `businessEntityId` (from deployment), `operatorProductId`, `slot`, `amountInCents`.

---

### I-2 — Machine server: no active contract → 422

**Preconditions:** Machine exists but has only a `draft` contract (or no contract).

**Steps:** `POST /purchase` with valid machine auth.

**Assertions:** Response `422 { code: "NO_ACTIVE_CONTRACT" }`. No row inserted.

---

### I-3 — Machine server: no open deployment → purchase recorded with null businessEntityId

**Preconditions:** Active contract (no deployment open).

**Steps:** `POST /purchase`.

**Assertions:** `201`; row inserted; `businessEntityId` is `null`.

---

### I-4 — Operator: list purchases scoped to org

**Layer:** `operator.purchase.list` tRPC

**Preconditions:**
- Two orgs (`orgA`, `orgB`) each with purchases.
- User is member of `orgA` only.

**Steps:** Call `operator.purchase.list({ orgSlug: orgA.slug })`.

**Assertions:**
- Returns only purchases where `organizationId = orgA.id`.
- No rows from `orgB`.

---

### I-5 — Operator: cross-org access blocked

**Steps:** Call `operator.purchase.list({ orgSlug: orgB.slug })` as a member of `orgA` only.

**Assertions:** `FORBIDDEN` tRPC error.

---

### I-6 — Operator: date-range filter

**Preconditions:** Three purchases for org: yesterday, today, tomorrow (future `purchasedAt`).

**Steps:** `operator.purchase.list({ orgSlug, startDate: today, endDate: today })`.

**Assertions:** Only today's purchase returned.

---

### I-7 — Operator: business entity filter

**Preconditions:** Two purchases, different `businessEntityId` values.

**Steps:** `operator.purchase.list({ orgSlug, businessEntityId: entityA.id })`.

**Assertions:** Only purchase for `entityA` returned.

---

### I-8 — Admin: list purchases any org

**Steps:** Admin calls `admin.purchase.list({ organizationId: orgB.id })`.

**Assertions:** Returns purchases for `orgB`.

---

### I-9 — Admin: customer list includes machine count

**Preconditions:**
- OrgA: two machines with active contracts.
- OrgB: one machine with active contract, one with draft.

**Steps:** Admin calls `admin.customer.list`.

**Assertions:**
- `orgA.machineCount = 2`.
- `orgB.machineCount = 1` (only active contracts counted).

---

### I-10 — Admin: machine filter on purchase list

**Preconditions:** OrgA has two machines, each with purchases.

**Steps:** `admin.purchase.list({ organizationId: orgA.id, machineId: machineX.id })`.

**Assertions:** Only purchases for `machineX` returned.

---

## Unit tests

### U-1 — CSV export utility

**Layer:** `packages/ui` or `apps/operator-frontend` export helper

**Inputs:**
```ts
[
  { purchasedAt: new Date("2025-01-15T10:30:00Z"), machineId: "m-1", slot: "left", productName: "Slush Red", amountInCents: 350, businessEntityName: "Betrieb A GmbH" }
]
```

**Assertions:**
- Output string is valid CSV with header row.
- Amount column is `3.50` (decimal, not cents).
- Date column is `2025-01-15`, time column is `11:30:00` (or UTC, document choice).

---

## E2E (optional, Playwright)

### E-1 — Operator can export CSV

1. Log in as operator, navigate to `/$orgSlug/purchases`.
2. Click "Export CSV".
3. Verify a file download is triggered (check `page.on('download', ...)`).
4. Verify downloaded file is a ZIP with a `purchases.csv` inside.

### E-2 — Admin: click customer row → customer detail loads

1. Log in as admin, navigate to `/customers`.
2. Click first customer row.
3. Verify URL changes to `/customers/:id` and org name visible.

---

## Coverage gaps (acceptable for v1)

- Machine server concurrent purchase inserts (race condition test) — defer.
- Full pagination correctness — manual QA.
- Admin slot-config display correctness — manual QA (display-only in v1).
