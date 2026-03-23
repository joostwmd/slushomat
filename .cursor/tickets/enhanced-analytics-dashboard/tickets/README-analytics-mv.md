# Analytics MV (T00) — quick link

- **Drizzle schema:** `packages/db/src/schema/analytics-purchase-daily-summary.ts` → `pnpm db:push`
- **Indexes:** `packages/db/src/migrations/0000_analytics_purchase_daily_summary_indexes.sql` → `pnpm db:migrate` (after push)
- **Docs:** `packages/db/docs/analytics-mv.md`


For multi Time zone support I Need to add a column to org with the time zone and updathe the materialized view SQl statement 