# Analytics materialized view: `analytics_purchase_daily_summary`

## TypeScript (`packages/db/src/schema/analytics-purchase-daily-summary.ts`)

Uses **`.existing()`** — Drizzle only uses this for **typed queries**. It does **not** run `CREATE MATERIALIZED VIEW` on `db:push` (avoids “duplicated view name” when the object already exists).

## Create the MV in the database

**Apply the migration** (creates the materialized view **and** indexes):

```bash
cd packages/db && pnpm db:migrate
```

Requires:

- `purchase`, `operator_contract`, `operator_contract_version` tables already exist (normal `db:push` for the rest of the app).
- Valid `DATABASE_URL` in `apps/server/.env` (as loaded by `drizzle.config.ts`).

After it succeeds, refresh your DB client — materialized views often appear under a **“Materialized views”** (or similar) section, **not** in the same list as regular tables.

### If `db:migrate` exits with code 1 and nothing useful is printed

1. Run the SQL yourself once to see the real error:

   ```bash
   psql "$DATABASE_URL" -f packages/db/src/migrations/0000_analytics_purchase_daily_summary.sql
   ```

2. If the migration was **recorded** as applied but the MV is still missing, clear that row and re-run migrate:

   ```sql
   SELECT * FROM "__drizzle_migrations";
   -- DELETE FROM "__drizzle_migrations" WHERE ... -- only if you confirm a bad state
   ```

### Changing the MV definition later

`CREATE MATERIALIZED VIEW IF NOT EXISTS` does **not** update an existing MV. To change the query you must `DROP MATERIALIZED VIEW analytics_purchase_daily_summary CASCADE;` (re-run migration / `REFRESH` as appropriate) or use a new migration.

## `db:push` vs `db:migrate`

| Command        | Role |
|----------------|------|
| `pnpm db:push` | Tables / enums from Drizzle schema (not this MV). |
| `pnpm db:migrate` | Runs `0000_analytics_purchase_daily_summary.sql` → **creates MV + indexes**. |

## `REFRESH MATERIALIZED VIEW CONCURRENTLY`

Needs the unique index from the same migration. Nightly refresh is still **outside** Drizzle (cron / pg_cron / worker).

## DST & timestamps

`purchase.purchased_at` is treated as UTC when stored as `timestamp without time zone`; revisit if you move to `timestamptz`.
