import {
  bigint,
  date,
  integer,
  pgMaterializedView,
  text,
} from "drizzle-orm/pg-core";

/**
 * Materialized view: closed purchase days (Europe/Berlin), excludes Berlin “today”.
 *
 * **DDL is applied by `pnpm db:migrate`** (`0000_analytics_purchase_daily_summary.sql`), not `db:push`,
 * so Drizzle Kit does not try to create the same object twice when it already exists in Postgres.
 *
 * `.existing()` = type-safe queries only; keep column list in sync with the migration SQL.
 */
export const analyticsPurchaseDailySummary = pgMaterializedView(
  "analytics_purchase_daily_summary",
  {
    bucketDate: date("bucket_date", { mode: "date" }).notNull(),
    operatorId: text("operator_id").notNull(),
    machineId: text("machine_id").notNull(),
    purchaseCount: integer("purchase_count").notNull(),
    grossAmountCents: bigint("gross_amount_cents", { mode: "bigint" }),
    platformRevenueShareCents: bigint("platform_revenue_share_cents", {
      mode: "bigint",
    }),
  },
).existing();
