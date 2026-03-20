import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "@slushomat/db";
import { member, organization } from "@slushomat/db/schema";

/** DB handle or Drizzle transaction — both support `.select()` / `.insert()` / etc. */
type DrizzleTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export type DbClient = typeof db | DrizzleTransaction;

/**
 * Resolves `organization.id` from slug. Operator `product.*` routes must use this
 * plus {@link assertUserMemberOfOrg} — including admins (admin UI uses `adminRouter`).
 */
export async function getOrganizationIdForSlug(
  dbClient: DbClient,
  slug: string,
): Promise<string> {
  const [row] = await dbClient
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Organization not found",
    });
  }
  return row.id;
}

export async function assertUserMemberOfOrg(
  dbClient: DbClient,
  userId: string,
  organizationId: string,
): Promise<void> {
  const [row] = await dbClient
    .select({ id: member.id })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId)),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not a member of this organization",
    });
  }
}
