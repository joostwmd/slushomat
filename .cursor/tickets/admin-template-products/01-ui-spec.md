# UI spec: Admin template products (implemented in-app)

## Upload failure (`TemplateProductUploadFailureDialog`)

- After a failed signed upload / confirm, offers **Retry upload**, **Delete this product**, **Keep without image**.

## Replace image (`ReplaceTemplateProductImageDialog`)

- When selecting a new file while an image already exists (existing URL or pending file), confirms replacement.

## Delete (`DeleteTemplateProductDialog`)

- Confirms deletion before calling `templateProduct.delete`.

## Primary surface

- List + sheet (create/edit) patterned after **Machines**; image area is click + drag-drop with native file input. Copy on the page states JPEG/PNG and 5&nbsp;MB limits.
