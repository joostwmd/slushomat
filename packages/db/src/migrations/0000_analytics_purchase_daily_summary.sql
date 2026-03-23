-- Analytics MV + indexes (single migration). Drizzle `db:push` does not manage this object — see
-- `analytics-purchase-daily-summary.ts` (`.existing()`) + packages/db/docs/analytics-mv.md
--
-- Idempotent: safe if the MV was created earlier via psql or a previous attempt.
CREATE MATERIALIZED VIEW IF NOT EXISTS "analytics_purchase_daily_summary" AS
SELECT
  p.bucket_date,
  p.organization_id,
  p.machine_id,
  COUNT(*)::integer AS purchase_count,
  COALESCE(SUM(p.amount_in_cents), 0)::bigint AS gross_amount_cents,
  COALESCE(
    SUM((p.amount_in_cents * cv.revenue_share_basis_points) / 10000),
    0
  )::bigint AS platform_revenue_share_cents
FROM (
  SELECT
    purchase.id,
    purchase.organization_id,
    purchase.machine_id,
    purchase.amount_in_cents,
    purchase.purchased_at,
    ((purchase.purchased_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin')::date AS bucket_date
  FROM purchase
) AS p
INNER JOIN LATERAL (
  SELECT v.revenue_share_basis_points
  FROM operator_contract AS c
  INNER JOIN operator_contract_version AS v ON v.entity_id = c.id
  WHERE
    c.machine_id = p.machine_id
    AND c.organization_id = p.organization_id
    AND v.effective_date <= p.purchased_at
    AND (v.ended_at IS NULL OR p.purchased_at < v.ended_at)
  ORDER BY v.effective_date DESC, v.version_number DESC
  LIMIT 1
) AS cv ON true
WHERE
  p.bucket_date
  < ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin')::date
GROUP BY
  p.bucket_date,
  p.organization_id,
  p.machine_id;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_purchase_daily_summary_uidx" ON "analytics_purchase_daily_summary" USING btree ("bucket_date","organization_id","machine_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_purchase_daily_summary_org_bucket_idx" ON "analytics_purchase_daily_summary" USING btree ("organization_id","bucket_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_purchase_daily_summary_machine_bucket_idx" ON "analytics_purchase_daily_summary" USING btree ("machine_id","bucket_date");
