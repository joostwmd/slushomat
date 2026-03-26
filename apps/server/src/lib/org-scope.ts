import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "@slushomat/db";
import { member, operator } from "@slushomat/db/schema";

/** DB handle or Drizzle transaction — both support `.select()` / `.insert()` / etc. */
type DrizzleTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export type DbClient = typeof db | DrizzleTransaction;

/**
 * Resolves operator id from slug. Operator app routes must use this
 * plus {@link assertUserMemberOfOrg} — including admins (admin UI uses `adminRouter`).
 */
export async function getOperatorIdForSlug(
  dbClient: DbClient,
  slug: string,
): Promise<string> {
  const [row] = await dbClient
    .select({ id: operator.id })
    .from(operator)
    .where(eq(operator.slug, slug))
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Operator not found",
    });
  }
  return row.id;
}

/** @deprecated Use {@link getOperatorIdForSlug} */
export const getOrganizationIdForSlug = getOperatorIdForSlug;

export async function assertUserMemberOfOrg(
  dbClient: DbClient,
  userId: string,
  operatorId: string,
): Promise<void> {
  const [row] = await dbClient
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.operatorId, operatorId)))
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not a member of this operator",
    });
  }
}
