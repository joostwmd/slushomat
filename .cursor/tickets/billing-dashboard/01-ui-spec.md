# UI Spec: Billing Dashboard (`billing-dashboard`)

## Placement

### Admin frontend

| Route | Label / Nav entry |
|-------|-------------------|
| `/_admin/customers` | **Customers** (existing stub, now implemented) |
| `/_admin/customers/$customerId` | Customer detail (no nav entry; accessed by clicking a row) |
| `/_admin/customers/$customerId/machines/$machineId` | Machine detail (no nav entry; accessed from customer detail) |

The existing `/_admin/contracts` route already has its own nav entry; the "Configure Contract" button on machine-detail navigates there with query params.

### Operator frontend

| Route | Label / Nav entry |
|-------|-------------------|
| `/_protected/$orgSlug/purchases` | **Purchases** (new nav link in operator sidebar) |
| `/_protected/$orgSlug/machines/$machineId/purchases` | Machine purchases (no nav entry; accessed from machine cards on Purchases page, or from the machine detail) |

---

## Shared composite: `PurchasesTable` (`packages/ui`)

### Props interface

```ts
interface PurchasesTableProps {
  data: PurchaseRow[];
  isLoading: boolean;
  // filter state (controlled by parent)
  filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    businessEntityId?: string;
    machineId?: string;
  };
  onFiltersChange?: (filters: PurchasesTableProps["filters"]) => void;
  onExportCsv?: () => void;         // present on operator pages; absent on read-only admin views (or present but wired differently)
  showMachineColumn?: boolean;       // true on org-wide tables; false on per-machine tables
  showEntityColumn?: boolean;        // true when multiple entities; false on single-entity views
}

interface PurchaseRow {
  id: string;
  purchasedAt: Date;
  machineId: string;
  slot: "left" | "middle" | "right";
  productName: string;
  amountInCents: number;
  businessEntityName?: string | null;
}
```

### Column definitions

| Column | Format | Visible by default |
|--------|--------|-------------------|
| **Date / Time** | `dd.MM.yyyy HH:mm` (German locale) | Always |
| **Machine** | Monospace ID, truncated | `showMachineColumn` |
| **Slot** | Capitalised (`Left`, `Middle`, `Right`) | Always |
| **Product** | Product name string | Always |
| **Amount** | `€ X,XX` (EUR, German locale) | Always |
| **Business Entity** | Entity name | `showEntityColumn` |

### Filter row

Rendered above the table:

- **Date range**: two date-picker inputs ("From" / "To"); clears to show all.
- **Business entity**: single-select dropdown (options supplied via prop); "All entities" default.
- **Machine**: single-select dropdown (options supplied via prop); only shown when `showMachineColumn` is true.
- **Export CSV button**: icon button (download icon) with label "Export CSV"; triggers `onExportCsv`; hidden when prop absent.

### Empty & loading states

- Loading: skeleton rows (5 rows, same column width).
- Empty (no filter): "No purchases yet" with a small icon.
- Empty (with active filter): "No results for this filter — try widening the date range."

---

## Admin: Customers page (`/_admin/customers`)

### Header row

```
Customers                          [+ New Customer]
```

"New Customer" button → navigates to `/_admin/create-customer`.

### Customer table

Columns:

| Column | Source |
|--------|--------|
| **Name** | `organization.name` |
| **Slug** | `organization.slug` (monospace, secondary) |
| **Active machines** | Count of machines with active contract (`admin.customer.list` `machineCount`) |
| **Created** | `organization.createdAt` (relative date) |

- Rows are clickable → navigates to `/_admin/customers/$customerId`.
- Searchable by name (client-side filter on loaded rows, or server-side `search` param — implementation choice).
- Sorted by `createdAt` descending by default.
- Empty state: "No customers yet. Create the first one."

---

## Admin: Customer detail (`/_admin/customers/$customerId`)

### Page header

```
← Customers   [org name]   [slug badge]
```

### Tabs (or stacked sections — implementation choice)

1. **Overview** — business entities list (reuses existing `admin.businessEntity.listByOrganization`); inline "Add Entity" action.
2. **Machines** — table of machines with at least one contract for this org:
   - Columns: Machine ID (monospace), Version, Contract status (badge: draft/active/terminated), Deployed? (yes/no).
   - Row click → `/_admin/customers/$customerId/machines/$machineId`.
3. **Products** — grid of operator products for this org (read-only; reuses existing product card pattern).
4. **Purchases** — `PurchasesTable` wired to `admin.purchase.list({ organizationId })`, `showMachineColumn: true`, `showEntityColumn: true`.

---

## Admin: Machine detail (`/_admin/customers/$customerId/machines/$machineId`)

### Page header

```
← [org name]   Machine [machineId]   [version badge]   [Configure Contract →]
```

"Configure Contract" is a link button that navigates to:
`/_admin/contracts?organizationId=<customerId>&machineId=<machineId>`

The existing contracts route must accept (and optionally pre-fill a create form with) these query params — implementation detail for the frontend agent.

### Sections (vertical stack)

1. **Purchases** — `PurchasesTable` wired to `admin.purchase.list({ machineId })`, `showMachineColumn: false`, `showEntityColumn: true`.
2. **Slot configuration** — read-only card showing left / middle / right slot assignment for the current deployment (or "No active deployment" empty state). Reuses the slot data from `operator.machineSlot.getConfigForMachine` or equivalent read-only admin fetch.
3. **Contract** — card showing the current active (or latest) operator contract: status badge, effective date, monthly rent (formatted EUR), revenue share (formatted %), business entity name. If no contract: "No contract on file" empty state. Link to "View all versions" → `/_admin/contracts?machineId=<machineId>`.

---

## Operator: Purchases page (`/_protected/$orgSlug/purchases`)

### Layout

```
Purchases                         [Export CSV ↓]

[Date From] [Date To]  [Entity ▾]  [Machine ▾]

┌──────────────────────────────────────────┐
│  PurchasesTable (full org, all machines) │
└──────────────────────────────────────────┘

Your Machines
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Machine  │ │ Machine  │ │ Machine  │
│ card     │ │ card     │ │ card     │
└──────────┘ └──────────┘ └──────────┘
```

### Machine cards grid

- One card per machine under an active contract for this org.
- Card content: machine ID (monospace, prominent), version number, deployment status (Deployed / Not deployed).
- Click → `/$orgSlug/machines/$machineId/purchases`.
- Same visual style as the existing `/$orgSlug/machines` page cards.
- Empty state if no machines: "No machines under contract yet."

### Export CSV behaviour

1. User clicks "Export CSV".
2. All currently-filtered rows are used (no extra fetch if already loaded; if filtered data not fully loaded, fetch with same filters without pagination limit).
3. CSV columns: `Date`, `Time`, `Machine ID`, `Slot`, `Product`, `Amount (EUR)`, `Business Entity`.
4. Amount formatted as decimal (`12.50` not `1250`).
5. Date: `YYYY-MM-DD`, Time: `HH:MM:SS`.
6. Wrapped in a ZIP archive; filename: `purchases-<orgSlug>-<YYYY-MM-DD>.zip`; inner file: `purchases.csv`.
7. Browser download triggered via `<a>` with `createObjectURL`.

---

## Operator: Machine purchases (`/_protected/$orgSlug/machines/$machineId/purchases`)

### Layout

```
← Machines   Machine [machineId] — Purchases

[Date From] [Date To]  [Entity ▾]

┌──────────────────────────────────────────┐
│  PurchasesTable (machineId fixed)        │
└──────────────────────────────────────────┘
```

- `showMachineColumn: false` (redundant when on a machine-specific page).
- Export CSV available with the same behaviour; filename: `purchases-<machineId>-<YYYY-MM-DD>.zip`.

---

## States & errors

| State | Location | Treatment |
|-------|----------|-----------|
| No purchases (no filter) | Both operator pages | "No purchases recorded yet." empty state |
| No purchases (filter active) | Both operator pages | "No results — try a wider date range or different filter." |
| No machines | Operator purchases machine cards | "No machines under contract yet." with link to `/machines` |
| No contract for machine (admin machine-detail) | Contract section | "No contract on file." with "Create contract" link |
| No deployment (slot config) | Admin machine-detail slot section | "No active deployment." |
| Export in progress | Operator export button | Spinner on button; disabled while generating |

---

## Open UX decisions (minor — resolve in plan/implementation)

- Tabs vs stacked sections for customer-detail page (tabs preferred for brevity).
- Whether `admin.purchase.list` also supports export CSV from the admin side (not required in v1 per requirements; operator-only for now).
- Exact column widths and responsive behaviour (follow existing table patterns in codebase).
