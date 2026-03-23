# Drizzle migrations

This repo commonly applies schema with **`pnpm db:push`** (see `package.json` `db:push`).

A full `drizzle-kit generate` baseline was **not** committed for `operator-machine-lifecycle`: existing databases already contain prior tables, so a `0000_*.sql` that recreates everything would be unsafe.

**After pulling schema changes (e.g. business entities, contracts, deployments):**

```bash
cd packages/db && pnpm db:push
```

When you adopt versioned migrations, baseline from production (`drizzle-kit pull` / introspect) then generate incremental files from there.

## Materialized views (analytics)

- **`pnpm db:push`** — app tables only (MV is `.existing()` in schema, not pushed).
- **`pnpm db:migrate`** — creates `analytics_purchase_daily_summary` + indexes via `0000_analytics_purchase_daily_summary.sql`.

Docs: `packages/db/docs/analytics-mv.md`
