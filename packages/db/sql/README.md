# Standalone SQL

Scripts here are **not** applied by `pnpm db:push` (Drizzle schema push). Run them explicitly against your Postgres instance when adopting features that need raw SQL (e.g. materialized views).

| File | Description |
|------|-------------|
| `analytics_purchase_daily_summary_mv.sql` | MV + indexes for enhanced analytics dashboard (T00). See `../docs/analytics-mv.md`. |
