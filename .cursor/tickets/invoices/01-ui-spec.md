# UI spec: Invoices

## Design system

- **Shadcn / `@slushomat/ui`** components: Card, Sheet, Button, Select, Empty states, tables or list rows consistent with **Admin Contracts** and **Operator Contracts** pages.
- **Tabs:** Use **Shadcn Tabs** (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) for operator Documents. If `tabs` is not in `packages/ui`, add via shadcn CLI to the shared UI package and export from `base/tabs`.
- **File upload:** **Dice UI** `@diceui/file-upload` dropzone on admin create form (same integration pattern as admin Products).

## Admin — global Invoices

### Navigation

- Add sidebar item **Invoices** (e.g. `FileStack` or `Receipt` icon) linking to `/_admin/invoices`, placed after **Contracts** to mirror mental model.
- Breadcrumbs: **Invoices** → optional **New** when on create.

### List page (`/_admin/invoices`)

- Mirror **Contracts** list patterns:
  - Filters: **Organization** (select), **Business entity** (optional, dependent on org), **Date range** on invoice period or `createdAt` (product choice).
  - Table or card rows: invoice **name**, **organization**, **business entity**, **period**, **rent** (€), **revenue share** (€), **created**, actions (**View**, **Download PDF**).
- Primary action: **New invoice** → navigate to create flow (same page with sheet vs dedicated `/invoices/new` — **recommend** sheet or dedicated route consistent with contracts; if contracts use inline sheet, match that).

### Create invoice

**Stepped or single form** (prefer single scrollable form with clear sections):

1. **Organization** — `Select` (reuse `admin.listOrganizations` pattern from contracts).
2. **Business entity** — `Select` filtered by chosen org (`admin` business entity list procedure; add if missing).
3. **Invoice name** — required text `Input`.
4. **Billing period** — date controls per requirements open point (e.g. month picker or start/end).
5. **Computed amounts** — read-only display after server **preview** mutation **or** show after submit only:
   - **Recommend:** `invoices.previewCalculation` tRPC query/mutation that returns `{ rentCents, revenueShareCents }` when org + entity + period are valid, so admin sees numbers before upload.
6. **PDF** — Dice UI dropzone; show file name, size, clear; enforce PDF + max size messaging.
7. **Submit** — disabled until name, org, entity, period, file present (and preview succeeded if using preview).

**Errors:** Toast + inline (no active contracts, validation, upload failure). Loading states on submit.

### Detail (optional v1)

- Row click opens **Sheet** with metadata + **Download PDF** (signed URL), matching contract detail pattern.

## Operator — Documents

### Navigation

- Replace sidebar label **Contracts** with **Documents** (icon can stay `FileText` or use `FolderOpen`).
- Target path: **`/$orgSlug/documents`** (new parent route).

### Routing / migration

- Move existing contracts page content under **Tabs** default tab **Contracts**, or:
  - **Option A (recommended):** New layout route `documents.tsx` with tabs; **Contracts** tab content = current contracts component (extract shared component from `contracts.tsx` if needed).
  - **Option B:** Redirect `/contracts` → `/documents?tab=contracts` for bookmarks.
- Preserve **`machineId` search param** on Contracts tab (`?machineId=`) for deep links from machines.

### Tabs

- **Tab 1 — Contracts:** Existing contracts UI (filters, list, sheet, PDF open).
- **Tab 2 — Invoices:** 
  - List invoices for `orgSlug` (tRPC `operator.invoice.list`).
  - Columns: name, period, rent, revenue share, date; row action **Download** / **View** (sheet with summary + download).
  - Empty state: short explanation (“Invoices appear here when your administrator adds them.”).

### Active state

- Sidebar **Documents** active when path is `/…/documents` (including tab query if used).

## Accessibility

- Tab list keyboard navigation (Radix/shadcn default).
- Dropzone: visible label, error announcements compatible with Dice UI patterns.
- PDF actions: button text “Download invoice PDF” not icon-only without `aria-label`.

## Responsive

- Admin: filters stack on small screens (same as contracts).
- Operator: tabs scroll horizontally on narrow view if needed (`TabsList` overflow).
