# Analytics materialized view: `analytics_purchase_daily_summary`

## Purpose

Pre-aggregate **closed** purchase days for dashboards (hybrid model: MV for history, live `purchase` queries for “today” in **Europe/Berlin** — see T01).

## Grain

One row per `(bucket_date, organization_id, machine_id)`:

- `bucket_date` — calendar date in **Europe/Berlin** (handles CET/CEST).
- `organization_id`, `machine_id` — `text`, aligned with `purchase`.
- **Excluded from MV:** the current Berlin calendar **today** and all future dates (filter uses “today” at **refresh** time).

## Measures

| Column | Meaning |
|--------|---------|
| `purchase_count` | Number of purchases |
| `gross_amount_cents` | Sum of `purchase.amount_in_cents` |
| `platform_revenue_share_cents` | Sum of per-row `(amount_in_cents * revenue_share_basis_points) / 10000` (integer division; ≥ 0) |

**Deferred (not in this MV):** product / business-entity JSON breakdowns, prorated rent, operator net — can be added in a follow-up MV or computed in API (see plan §1.1).

## Contract version at purchase time

Rows are joined to `operator_contract` + `operator_contract_version` with a **temporal** predicate (not `current_version_id`):

- `v.effective_date <= purchase.purchased_at`
- `v.ended_at IS NULL OR purchase.purchased_at < v.ended_at`
- If multiple versions match (data anomaly), the **latest** `effective_date` (then `version_number`) wins (`LIMIT 1`).

Purchases with **no** matching version are **dropped** from the aggregate (should not happen if machine server only records purchases under an active contract).

## Timestamp assumption

`purchase.purchased_at` and contract version timestamps are interpreted as **UTC** when the column is `timestamp without time zone` (Drizzle default), using:

`((purchased_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin')::date`

If columns are migrated to `timestamptz`, revisit this expression with DBA.

## Refresh

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_purchase_daily_summary;
```

Requires the **unique** index defined in `packages/db/sql/analytics_purchase_daily_summary_mv.sql`.

Schedule outside the app (T05): e.g. shortly after midnight Europe/Berlin.

## DST

Berlin zone name `Europe/Berlin` encodes DST rules; bucketing uses zone conversion, not fixed offsets.
