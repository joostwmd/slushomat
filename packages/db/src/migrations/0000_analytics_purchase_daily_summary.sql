-- Analytics MV + indexes. See `analytics-purchase-daily-summary.ts` (`.existing()`).
-- Matches current Drizzle schema (operator_id, operator_machine, contract link).
-- If this definition drifts from `db:push` tables: DROP MATERIALIZED VIEW IF EXISTS analytics_purchase_daily_summary; then db:migrate.
--
-- Also: row-level audit (Supabase-style) — not managed by `db:push`. Requires `db:push` first so audited tables exist.
CREATE MATERIALIZED VIEW IF NOT EXISTS "analytics_purchase_daily_summary" AS
SELECT
  p.bucket_date,
  p.operator_id,
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
    purchase.operator_id,
    purchase.machine_id,
    purchase.amount_in_cents,
    purchase.purchased_at,
    ((purchase.purchased_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin')::date AS bucket_date
  FROM purchase
) AS p
INNER JOIN LATERAL (
  SELECT v.revenue_share_basis_points
  FROM operator_contract AS c
  INNER JOIN operator_machine AS om ON om.id = c.operator_machine_id
  INNER JOIN operator_contract_version AS v ON v.entity_id = c.id
  WHERE
    om.machine_id = p.machine_id
    AND c.operator_id = p.operator_id
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
  p.operator_id,
  p.machine_id;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_purchase_daily_summary_uidx" ON "analytics_purchase_daily_summary" USING btree ("bucket_date","operator_id","machine_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_purchase_daily_summary_org_bucket_idx" ON "analytics_purchase_daily_summary" USING btree ("operator_id","bucket_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_purchase_daily_summary_machine_bucket_idx" ON "analytics_purchase_daily_summary" USING btree ("machine_id","bucket_date");
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS audit;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS audit.record_version (
  id serial PRIMARY KEY NOT NULL,
  record_id text,
  old_record_id text,
  op text,
  ts timestamp DEFAULT now() NOT NULL,
  table_oid integer NOT NULL,
  table_schema text NOT NULL,
  table_name text NOT NULL,
  record jsonb,
  old_record jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS record_version_ts ON audit.record_version USING brin (ts);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS record_version_table_oid ON audit.record_version USING btree (table_oid);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit.primary_key_columns(entity_oid oid)
  RETURNS text[]
  STABLE
  SECURITY DEFINER
  LANGUAGE sql
AS $$
  SELECT coalesce(
    array_agg(pa.attname::text ORDER BY pa.attnum),
    array[]::text[]
  )
  FROM pg_index pi
  JOIN pg_attribute pa
    ON pi.indrelid = pa.attrelid
   AND pa.attnum = ANY (pi.indkey)
  WHERE pi.indrelid = $1
    AND pi.indisprimary;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit.to_record_id(
  entity_oid oid,
  pkey_cols text[],
  rec jsonb
)
  RETURNS uuid
  STABLE
  LANGUAGE sql
AS $$
  SELECT CASE
    WHEN rec IS NULL THEN NULL
    WHEN pkey_cols = array[]::text[] THEN gen_random_uuid()
    ELSE (
      SELECT uuid_generate_v5(
        'fd62bc3d-8d6e-43c2-919c-802ba3762271'::uuid,
        (jsonb_build_array(to_jsonb($1)) || jsonb_agg($3 ->> key_))::text
      )
      FROM unnest($2) AS x(key_)
    )
  END;
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS record_version_record_id ON audit.record_version (record_id)
  WHERE record_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS record_version_old_record_id ON audit.record_version (old_record_id)
  WHERE old_record_id IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit.insert_update_delete_trigger()
  RETURNS trigger
  SECURITY DEFINER
  LANGUAGE plpgsql
AS $$
DECLARE
  pkey_cols text[] := audit.primary_key_columns(TG_RELID);
  record_jsonb jsonb := to_jsonb(NEW);
  record_id uuid := audit.to_record_id(TG_RELID, pkey_cols, record_jsonb);
  old_record_jsonb jsonb := to_jsonb(OLD);
  old_record_id uuid := audit.to_record_id(TG_RELID, pkey_cols, old_record_jsonb);
BEGIN
  INSERT INTO audit.record_version (
    record_id,
    old_record_id,
    op,
    table_oid,
    table_schema,
    table_name,
    record,
    old_record
  )
  SELECT
    record_id::text,
    old_record_id::text,
    TG_OP,
    TG_RELID,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    record_jsonb,
    old_record_jsonb;

  RETURN coalesce(NEW, OLD);
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit.enable_tracking(regclass)
  RETURNS void
  VOLATILE
  SECURITY DEFINER
  LANGUAGE plpgsql
AS $$
DECLARE
  statement_row text := format(
    'create trigger audit_i_u_d
       before insert or update or delete
       on %s
       for each row
       execute procedure audit.insert_update_delete_trigger();',
    $1::text
  );
  pkey_cols text[] := audit.primary_key_columns($1);
BEGIN
  IF pkey_cols = array[]::text[] THEN
    RAISE EXCEPTION 'Table % cannot be audited because it has no primary key', $1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = $1 AND tgname = 'audit_i_u_d'
  ) THEN
    EXECUTE statement_row;
  END IF;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit.disable_tracking(regclass)
  RETURNS void
  VOLATILE
  SECURITY DEFINER
  LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('drop trigger if exists audit_i_u_d on %s;', $1::text);
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'organization_machine_display_name'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'organization_machine_display_name'
      AND c.contype = 'p'
  ) THEN
    DROP INDEX IF EXISTS organization_machine_display_name_org_machine_uidx;
    ALTER TABLE public.organization_machine_display_name
      ADD PRIMARY KEY (organization_id, machine_id);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  PERFORM audit.enable_tracking('public.account'::regclass);
  PERFORM audit.enable_tracking('public.apikey'::regclass);
  PERFORM audit.enable_tracking('public.business_entity'::regclass);
  PERFORM audit.enable_tracking('public.document'::regclass);
  PERFORM audit.enable_tracking('public.invitation'::regclass);
  PERFORM audit.enable_tracking('public.invoice'::regclass);
  PERFORM audit.enable_tracking('public.invoice_line_item'::regclass);
  PERFORM audit.enable_tracking('public.machine'::regclass);
  PERFORM audit.enable_tracking('public.machine_slot'::regclass);
  PERFORM audit.enable_tracking('public.machine_version'::regclass);
  PERFORM audit.enable_tracking('public.member'::regclass);
  PERFORM audit.enable_tracking('public.operator'::regclass);
  PERFORM audit.enable_tracking('public.operator_contract'::regclass);
  PERFORM audit.enable_tracking('public.operator_contract_change'::regclass);
  PERFORM audit.enable_tracking('public.operator_contract_version'::regclass);
  PERFORM audit.enable_tracking('public.operator_machine'::regclass);
  PERFORM audit.enable_tracking('public.operator_machine_display_name'::regclass);
  PERFORM audit.enable_tracking('public.operator_product'::regclass);
  PERFORM audit.enable_tracking('public.product_image'::regclass);
  PERFORM audit.enable_tracking('public.purchase'::regclass);
  PERFORM audit.enable_tracking('public.session'::regclass);
  PERFORM audit.enable_tracking('public.template_product'::regclass);
  PERFORM audit.enable_tracking('public.user'::regclass);
  PERFORM audit.enable_tracking('public.verification'::regclass);
END $$;
