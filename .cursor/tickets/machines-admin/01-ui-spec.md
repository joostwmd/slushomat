# UI spec: Machines admin

## Route

- Path: `/machines` under `_admin` layout.
- File: `apps/admin-frontend/src/routes/_admin/machines.tsx`.
- Breadcrumbs: already mapped in `admin-breadcrumbs.tsx`.

## Layout

Single page, two primary blocks (order: **Versions** first, then **Machines**). Use `@slushomat/ui` and match spacing/typography of other admin placeholder pages (`container`, `max-w-4xl`, etc.), upgraded to real content.

## Block A — Machine versions

- **Table columns:** version number, description (truncate with tooltip or title), created at (optional but useful).
- **Primary action:** “Add version” opens **dialog** (or sheet) with:
  - Version number — required text input; inline error if empty or duplicate (server conflict).
  - Description — required multiline or single-line (align with API validation).
- **Row actions (v1):** “Edit version” opens the same dialog pattern as add, pre-filled: **version number** read-only, **description** editable (this is the version “comment” in product language). Save calls update mutation. **Delete version** with confirm; on conflict (still referenced), show toast/error from API.

## Block B — Machines

- **Table columns:** short id (e.g. first 8 chars + copy or full monospace), linked version number, comments (truncated).
- **Primary action:** “Add machine” — disabled or blocked with helper text if **no versions** exist yet.
  - Fields: version **select** (from versions list query), comments **textarea**.
- **Row actions:** “Edit” (same fields as create), “Delete” with confirm.

## Empty / loading / error

- **Loading:** skeleton or spinner on each block.
- **Empty versions:** short explanation; machines block explains versions must exist first.
- **tRPC errors:** toast or inline alert; duplicate version number → friendly message.

## Accessibility

- Dialogs trap focus; labels on all inputs; destructive actions require confirmation.
