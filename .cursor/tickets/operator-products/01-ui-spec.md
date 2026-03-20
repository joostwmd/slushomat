# UI spec: Operator products (`operator-products`)

## Placement

- **Operator:** `/_protected/$orgSlug/products` (path **`/products`** under org base).
- **Admin:** existing template products route unchanged in URL; **components** may move to shared composite layer.

## Shared UI (`@slushomat/ui/composite`)

- Extract reusable pieces used by **both** admin template products and operator products, for example:
  - Product **form fields**: name, price (€), tax (7/19), image dropzone (JPEG/PNG, 5 MB) with validation messaging aligned to server.
  - Optional: **thumbnail** cell, **delete confirm** copy pattern.
- **Empty list (operator Products):** do **not** hand-roll a one-off empty block — use shadcn **Empty** (`npx shadcn add empty` into `packages/ui` / operator app per project conventions). Compose `EmptyHeader`, `EmptyTitle`, `EmptyDescription`, `EmptyContent` with two actions: **Create product**, **Add from template**. See [Empty component docs](https://ui.shadcn.com/docs/components/empty).
- Keep app-specific wiring (tRPC hooks, org slug, navigation) in each app; composite holds presentation + generic callbacks/props.

## Operator flows

### List

- Table/cards: image, name, price, tax %, actions (Edit, Delete).
- **Empty state:** shadcn **Empty** component + **Create product** + **Add from template** (see above).

### Create product

- Sheet or full page; use **composite product form**.
- Image upload flow same semantics as admin (signed URL + confirm), but API targets **operator** mutations and **new** `product_image` when needed.

### Add from template

- Modal/sheet: list global templates (thumb, name, price/tax).
- Primary action: **Add to our products** → copy with shared image ref; toast + list refresh.

### Edit / delete

- Edit: same form; changing image may detach from shared `product_image` if implementation creates a new image row.
- Delete: confirm dialog; copy can mirror admin delete wording adapted for “org product.”

## Admin template products (refactor note)

- After schema migration to `product_image`, admin page should use **same composite** building blocks where possible for visual and validation parity.

## Open UX (minor)

- Prefer **two clear actions** inside Empty (`Button` as `EmptyContent` children or footer pattern from docs).
