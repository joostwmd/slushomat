-- T01 — Migrate template_product_image → product_image + template_product.product_image_id,
-- drop template_product.organization_id, create operator_product.
--
-- WHEN TO RUN
-- • DB still has `template_product_image` and (pre-T01) `template_product.organization_id`:
--   run this script ONCE before `pnpm --filter @slushomat/db db:push`, or push will drop the old
--   image table and lose linkage data.
-- • Empty / new database: skip this file; use `db:push` only.
--
-- Human checkpoint BEFORE dropping organization_id: if any `template_product.organization_id`
-- IS NOT NULL in prod, migrate those rows into `operator_product` first (see commented block below).

BEGIN;

-- 1) product_image
CREATE TABLE IF NOT EXISTS "product_image" (
  "id" text PRIMARY KEY NOT NULL,
  "bucket" text NOT NULL,
  "object_path" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 2) Nullable FK on template_product
ALTER TABLE "template_product" ADD COLUMN IF NOT EXISTS "product_image_id" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'template_product_product_image_id_product_image_id_fk'
  ) THEN
    ALTER TABLE "template_product"
      ADD CONSTRAINT "template_product_product_image_id_product_image_id_fk"
      FOREIGN KEY ("product_image_id") REFERENCES "product_image"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- 3) Backfill product_image (reuse template_product_image.id as product_image.id)
INSERT INTO "product_image" ("id", "bucket", "object_path", "created_at", "updated_at")
SELECT
  tpi."id",
  tpi."bucket",
  tpi."object_path",
  tpi."created_at",
  now()
FROM "template_product_image" AS tpi
ON CONFLICT ("id") DO NOTHING;

-- 4) Point templates at the new rows
UPDATE "template_product" AS tp
SET "product_image_id" = tpi."id"
FROM "template_product_image" AS tpi
WHERE tpi."template_product_id" = tp."id"
  AND tp."product_image_id" IS DISTINCT FROM tpi."id";

-- 5) Drop legacy image table
DROP TABLE IF EXISTS "template_product_image";

-- 6) Optional: migrate org-scoped templates before dropping organization_id
-- Uncomment and run ONLY if you have non-null organization_id rows to preserve:
--
-- INSERT INTO "operator_product" (
--   "id", "organization_id", "name", "price_in_cents", "tax_rate_percent",
--   "product_image_id", "source_template_product_id", "created_at", "updated_at"
-- )
-- SELECT
--   gen_random_uuid()::text,
--   tp."organization_id",
--   tp."name",
--   tp."price_in_cents",
--   tp."tax_rate_percent",
--   tp."product_image_id",
--   tp."id",
--   tp."created_at",
--   tp."updated_at"
-- FROM "template_product" tp
-- WHERE tp."organization_id" IS NOT NULL;
--
-- DELETE FROM "template_product" WHERE "organization_id" IS NOT NULL;
-- (Or adjust if you need to keep template rows — product decision.)

DROP INDEX IF EXISTS "template_product_organization_id_idx";
ALTER TABLE "template_product" DROP CONSTRAINT IF EXISTS "template_product_organization_id_organization_id_fk";
ALTER TABLE "template_product" DROP COLUMN IF EXISTS "organization_id";

-- 7) operator_product
CREATE TABLE IF NOT EXISTS "operator_product" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "price_in_cents" integer NOT NULL,
  "tax_rate_percent" integer NOT NULL,
  "product_image_id" text,
  "source_template_product_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operator_product_organization_id_organization_id_fk'
  ) THEN
    ALTER TABLE "operator_product"
      ADD CONSTRAINT "operator_product_organization_id_organization_id_fk"
      FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operator_product_product_image_id_product_image_id_fk'
  ) THEN
    ALTER TABLE "operator_product"
      ADD CONSTRAINT "operator_product_product_image_id_product_image_id_fk"
      FOREIGN KEY ("product_image_id") REFERENCES "product_image"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operator_product_source_template_product_id_template_product_id_fk'
  ) THEN
    ALTER TABLE "operator_product"
      ADD CONSTRAINT "operator_product_source_template_product_id_template_product_id_fk"
      FOREIGN KEY ("source_template_product_id") REFERENCES "template_product"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "operator_product_organization_id_idx" ON "operator_product" ("organization_id");
CREATE INDEX IF NOT EXISTS "operator_product_source_template_product_id_idx" ON "operator_product" ("source_template_product_id");

COMMIT;
