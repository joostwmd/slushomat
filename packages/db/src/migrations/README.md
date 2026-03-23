# Drizzle migrations

This repo commonly applies schema with **`pnpm db:push`** (see `package.json` `db:push`).

A full `drizzle-kit generate` baseline was **not** committed for `operator-machine-lifecycle`: existing databases already contain prior tables, so a `0000_*.sql` that recreates everything would be unsafe.

**After pulling schema changes (e.g. business entities, contracts, deployments):**

```bash
cd packages/db && pnpm db:push
```

When you adopt versioned migrations, baseline from production (`drizzle-kit pull` / introspect) then generate incremental files from there.

## Materialized views

Drizzle `db:push` does **not** create materialized views. For analytics, apply:

- `packages/db/sql/analytics_purchase_daily_summary_mv.sql`
- Docs: `packages/db/docs/analytics-mv.md`
