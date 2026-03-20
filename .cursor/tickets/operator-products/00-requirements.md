# Requirements: Operator org products (`operator-products`)

## Summary

**Operators** manage a **per-organization product catalog** from the operator dashboard on a **Products** page. They can:

1. **Create a new product** from scratch — same fields as template products (name, price in cents, tax 7/19, optional image JPEG/PNG max 5 MB).
2. **Add from template** — pick a **global template product**, **copy** its row into **`operator_product`**, and **reuse the same `product_image` row** (no second Storage object; both products point at the same image record).

**Admins** keep managing **global templates** only (`template_product` rows with no org). Operators do not edit templates via this feature.

## Feature slug

`operator-products`

## Actors

- **Operator user:** authenticated, member of the organization they are acting in.
- **Admin:** existing admin template products UI/API (will be refactored to shared `product_image` — see data model).

---

## Why “org context” matters (short)

If a user belongs to **more than one** organization, the server must know **which org’s** products to list or mutate. Otherwise they could pass one org’s id and read another’s data.

**Decision (for this feature):**

- **Source of truth:** the **organization in the URL** — `$orgSlug` on operator routes (e.g. `/acme-corp/products`).
- **API contract:** operator product procedures take **`organizationId`** or **`orgSlug`** (choose one in implementation) and the server **resolves the org**, then checks **`member`** (or equivalent) for `(userId, organizationId)` before any query.
- **`session.activeOrganizationId`:** optional alignment for UX (e.g. handoff); if present and used, it **must match** the URL org or the request is rejected. If the team prefers minimal work for MVP, **URL + membership check only** is enough.

**Follow-up code:** extend or wrap `operatorProcedure` so “operator” routes that are org-scoped receive `ctx.organizationId` (and optionally slug) after verification — not only “has any membership.”

---

## Data model (decided)

Three logical groups (Drizzle table names can follow existing style: `template_product`, `operator_product`, `product_image`).

### 1. `product_image`

Single table for **all** product images (templates and operator products).

- `id` (text PK)
- `bucket` (text, not null)
- `object_path` (text, not null)
- `created_at`, … (timestamps as per project norms)

**No** `template_product_id` / `operator_product_id` on this table — products **reference** the image.

**Sharing:** Multiple rows in `template_product` and/or `operator_product` may reference the **same** `product_image.id` (e.g. after “copy from template”).

**Deletes / storage:** When removing an image from Storage, do so only when **no** `template_product` or `operator_product` still references that `product_image` row (application logic or DB-safe pattern). Deleting a product row clears **its** FK; it does not delete `product_image` if others still point to it.

### 2. `template_product`

Global catalog row (admin-defined). Same business fields as today’s template line item:

- `id`, `name`, `price_in_cents`, `tax_rate_percent`, timestamps
- **`product_image_id`** nullable FK → `product_image.id` (replaces the old join-only `template_product_image` pattern)
- **No** `organization_id` on template rows for globals (or keep column dropped / unused for templates — product owner: templates are **only** global rows in this table).

*Migration note:* today’s `template_product_image` + `template_product` must be migrated into `product_image` + `template_product.product_image_id`; admin tRPC and UI updated accordingly.

### 3. `operator_product`

Per-organization catalog row.

- `id` (text PK)
- **`organization_id`** not null FK → `organization.id`
- Same product fields as template: `name`, `price_in_cents`, `tax_rate_percent`, timestamps
- **`product_image_id`** nullable FK → `product_image.id`
- **`source_template_product_id`** nullable FK → `template_product.id` (provenance when created from template; null when created from scratch)

**Copy from template:**

- `INSERT` into `operator_product` with copied name/price/tax (and org id).
- Set **`product_image_id`** = template’s `product_image_id` (same row — **no** new Storage upload, **no** duplicate `product_image` row).
- Set **`source_template_product_id`** = template id.

**Field parity:** Operator products use the **same** fields and validation rules as template products (including image MIME/size).

---

## Functional requirements

### FR-1 — Operator Products page

- Under `/$orgSlug/products`, list **this org’s** `operator_product` rows with thumbnail when `product_image_id` set.
- When the list is empty, use the **shadcn/ui [Empty](https://ui.shadcn.com/docs/components/empty)** pattern (add the `empty` block to `@slushomat/ui` via the shadcn CLI if not present yet). Inside it: short copy + primary/secondary actions **Create product** and **Add from template**.

### FR-2 — Create operator product

- Form same as template product (reuse shared UI where possible — see UI spec).
- Optional image upload creates **`product_image`** + sets FK on **new** `operator_product` only (template unchanged).

### FR-3 — Add from template

- List **global** `template_product` rows (with image preview via shared `product_image`).
- On confirm: copy row into `operator_product` for current org; **same `product_image_id`**; set `source_template_product_id`.

### FR-4 — Edit / delete operator product

- Edit same fields; replacing image may create a **new** `product_image` row and re-point FK, or reuse existing patterns (define in implementation; old image row garbage-collected when unreferenced).
- Delete `operator_product` only; do not delete shared `product_image` if still referenced elsewhere.

### FR-5 — Security

- All operator procedures: resolve org from **URL context + input**, verify membership, scope queries to `organization_id`.
- Operators cannot mutate `template_product` through operator routes.

### FR-6 — Defaults not yet specified by product owner (acceptable for plan phase)

| Topic | Default assumption (adjust in plan if needed) |
|-------|-----------------------------------------------|
| **Who may CRUD** | Any org member that can access operator app (`operatorProcedure`), unless you later restrict to owner/admin. |
| **Same template twice** | **Allowed** — two `operator_product` rows may share the same `source_template_product_id` and same `product_image_id`. |

---

## Non-goals (initial)

- Machines / POS / ordering.
- Operators editing global templates.
- Multi-currency beyond existing app behavior.
- **Automated tests** (unit, integration, E2E) for this feature; manual verification only (`02-test-spec.md` records the skip).

## UI package — shared components

- Place **shared** product form / image field / list patterns in [`packages/ui/src/composite/`](packages/ui/src/composite/) (e.g. next to [`auth-form.tsx`](packages/ui/src/composite/auth-form.tsx)), consumed by **admin** template products page and **operator** products page where it makes sense.

## References

- Current admin implementation: [`apps/server/src/trpc/routers/admin-template-products.ts`](apps/server/src/trpc/routers/admin-template-products.ts), [`packages/db/src/schema/template-products.ts`](packages/db/src/schema/template-products.ts)
- Operator routes: [`apps/operator-frontend/src/routes/_protected/$orgSlug/`](apps/operator-frontend/src/routes/_protected/$orgSlug/)
- Procedures: [`apps/server/src/trpc/procedures.ts`](apps/server/src/trpc/procedures.ts)
