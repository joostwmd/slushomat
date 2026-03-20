# Requirements: Admin template products + Supabase image storage

## Summary

Admins manage **standard template slush products** from a dedicated **Products** area in the admin app. Each **template product** has a **name**, **price**, **tax rate** (7% or 19%), and **one image**. Images are stored in **Supabase Storage**; the server issues a **signed upload URL** (and related token) so the browser uploads directly to Storage. A separate **`template_product_image`** table links storage objects to **template product** rows so the same model can later support **operator-scoped** products without redesigning storage linkage.

## Actors

- **Primary:** Platform admins (`role === "admin"`, existing admin layout guard).
- **Future:** Operators creating org-internal products (out of scope for MVP except **schema readiness**).

## Data model (intent)

- **`template_product`:** Template line item: name, price, tax rate (7 | 19), optional future `organization_id` (null = global template).
- **`template_product_image`:** Joins a template product to a bucket + object path (and metadata as needed). Supports multiple images per template product later; MVP may enforce one primary image in API/UI.

## Non-goals (MVP)

- Operator-facing product management UI.
- Full catalog versioning or machine assignment.
- Resumable / chunked uploads (standard signed upload is enough unless files are very large).
- Automated tests (unit, integration, E2E); manual verification is sufficient.

## Acceptance criteria

### Happy path

1. Given an admin is signed in, when they open **Products**, they see a list of template products (name, price, tax, thumbnail or placeholder).
2. Given an admin creates a product with valid fields, when they save, the product appears in the list.
3. Given an admin selects an image file, when the flow completes, the file is stored in the configured Supabase bucket and linked via `template_product_image`.
4. Given an admin edits name, price, or tax rate, when they save, the list reflects changes.
5. Given an admin deletes a product, when they confirm, the product (and linked image row; optionally storage object) is removed per agreed policy.

### Security & correctness

6. Only **admin** can list/create/update/delete template products and request upload URLs for them.
7. Upload URLs are **short-lived** and scoped to server-chosen object paths (no arbitrary client path).
8. Tax rate is restricted to **7** or **19** (percent).

### Edge cases

9. Upload failure after product create: user can retry upload or remove orphan product (define UX in UI spec).
10. Invalid file type / size: rejected before or during upload with clear feedback.

## Dependencies / infrastructure

- Supabase project with a **Storage bucket** (private or public per team choice; if private, signed **read** URLs or proxy needed for thumbnails).
- Env: server **service role** for `createSignedUploadUrl`; client **anon** key + project URL for `uploadToSignedUrl` (per Supabase JS docs).
- New workspace package **`@slushomat/supabase`**: admin Supabase client factory + **storage helper class** (signed upload, delete object, optional signed download).

## UI

- Admin route **Products** (path e.g. `/products` under `_admin`).
- **Dice UI** file upload (shadcn registry `@diceui/file-upload`) for the image control, aligned with existing `@slushomat/ui` and Tailwind setup.

## References (docs)

- [Supabase: `createSignedUploadUrl` / `uploadToSignedUrl`](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)
- [Dice UI: File upload](https://www.diceui.com/docs/components/file-upload)
