-- Revert auth tenant model to Better Auth default names:
-- table `organization`, member/invitation `organization_id`, session `active_organization_*`.
-- Domain tables keep SQL column `operator_id` (FK now targets `organization.id`).

ALTER TABLE "operator" RENAME TO "organization";

ALTER INDEX IF EXISTS "operator_slug_uidx" RENAME TO "organization_slug_uidx";

ALTER TABLE "member" RENAME COLUMN "operator_id" TO "organization_id";
ALTER INDEX IF EXISTS "member_operator_id_idx" RENAME TO "member_organization_id_idx";

ALTER TABLE "invitation" RENAME COLUMN "operator_id" TO "organization_id";
ALTER INDEX IF EXISTS "invitation_operator_id_idx" RENAME TO "invitation_organization_id_idx";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'session'
      AND column_name = 'active_operator_id'
  ) THEN
    ALTER TABLE "session" RENAME COLUMN "active_operator_id" TO "active_organization_id";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'session'
      AND column_name = 'active_operator_slug'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'session'
      AND column_name = 'active_organization_slug'
  ) THEN
    ALTER TABLE "session" RENAME COLUMN "active_operator_slug" TO "active_organization_slug";
  END IF;
END $$;
