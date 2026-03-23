-- Analytics: daily purchase aggregates per org + machine (closed days only, Europe/Berlin).
-- Apply manually or via your migration pipeline (this repo often uses `pnpm db:push` for Drizzle tables;
-- materialized views are not managed by Drizzle schema — keep this SQL in version control).
--
-- See: packages/db/docs/analytics-mv.md
--
-- After editing: DROP MATERIALIZED VIEW IF EXISTS analytics_purchase_daily_summary CASCADE;
-- then re-run CREATE + indexes, then initial REFRESH MATERIALIZED VIEW ...

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_purchase_daily_summary AS
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
    (
      (purchase.purchased_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin'
    )::date AS bucket_date
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
  < (
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin'
  )::date
GROUP BY
  p.bucket_date,
  p.organization_id,
  p.machine_id;

COMMENT ON MATERIALIZED VIEW analytics_purchase_daily_summary IS
  'Daily purchase aggregates by org+machine in Europe/Berlin. Excludes current Berlin calendar day (hybrid with live queries).';

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS analytics_purchase_daily_summary_uidx
  ON analytics_purchase_daily_summary (bucket_date, organization_id, machine_id);

CREATE INDEX IF NOT EXISTS analytics_purchase_daily_summary_org_bucket_idx
  ON analytics_purchase_daily_summary (organization_id, bucket_date);

CREATE INDEX IF NOT EXISTS analytics_purchase_daily_summary_machine_bucket_idx
  ON analytics_purchase_daily_summary (machine_id, bucket_date);
