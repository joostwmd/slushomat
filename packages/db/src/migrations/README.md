# Drizzle migrations

The first checked-in migration (`0000_*.sql`) snapshots **all** tables defined under `packages/db/src/schema/` (Better Auth + machines). Use one of:

- **Fresh database:** run `npm run db:migrate` from `packages/db` (or the repo root script) so the full migration applies once.
- **Database that already has auth tables:** do **not** apply the full `0000` file blindly (it will fail with “already exists”). Either baseline with Drizzle’s workflow for existing DBs, or run only the `machine_version` / `machine` DDL from the end of that file (create `machine_version`, unique index, `machine`, FK).

For local iteration, `npm run db:push` from `packages/db` is also valid.
