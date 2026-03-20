# Requirements: Machines admin (`machines-admin`)

## Summary

Admins manage a **global** catalog of **machine versions** and **machines**. Machine versions are reusable definitions; each machine references exactly one version and carries free-form **comments**.

## Acceptance criteria

1. **AC-1 — Machine versions (catalog)**  
   Admin can create a machine version with **version number** (unique globally) and **description**. Admin can list all versions (for tables and dropdowns).

2. **AC-1b — Edit version description (“comment”)**  
   Admin can **update** an existing version’s **description** (the long-form text for that version; same field people may call the version “comment”). **Version number** stays fixed after create in v1 (avoids confusing references in admin UI); only description is editable.

3. **AC-2 — Machines**  
   Admin can create a machine with **comments** and a **required** link to an existing machine version. Opaque **id** is system-generated (no separate human-facing name field in v1).

4. **AC-3 — Edit machine**  
   Admin can update **comments** and change the linked **machine version**.

5. **AC-4 — Delete machine**  
   Admin can delete a machine.

6. **AC-5 — Delete version safety**  
   Deleting a machine version that is still referenced by any machine must **fail** with a clear, user-visible error (no silent cascade).

7. **AC-6 — Admin-only**  
   All mutations and list data are only available to users passing existing **admin** auth (`adminProcedure` + `_admin` route guard).

8. **AC-7 — Machines page**  
   The existing admin route `/machines` is fully implemented (replaces “Coming soon”).

## Non-goals (v1)

- Organization / multi-tenant scoping for machines or versions.
- Operator app or machine-server credential binding to these rows.
- Automated test suite (explicit product decision; manual smoke only).

## Open questions

_None — resolved in discovery._

- Versions are a **shared catalog** (not per-machine lineage).
- Data is **global** for the admin app.
- Machine identity is **minimal**: id + comments + version link.

## Branch / workflow

Implementation should happen on a **feature branch** (not `main`).
