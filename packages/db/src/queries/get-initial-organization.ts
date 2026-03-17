import { eq, asc, sql } from "drizzle-orm";

import { db } from "../connection";
import { member, organization } from "../schema";

const getInitialOrganizationStmt = db
  .select({
    id: organization.id,
    slug: organization.slug,
  })
  .from(member)
  .innerJoin(organization, eq(member.organizationId, organization.id))
  .where(eq(member.userId, sql.placeholder("userId")))
  .orderBy(asc(member.createdAt))
  .limit(1)
  .prepare("get_initial_organization");

export async function getInitialOrganization(
  userId: string,
): Promise<{ id: string; slug: string } | null> {
  const rows = await getInitialOrganizationStmt.execute({ userId });
  const row = rows[0];
  return row ? { id: row.id, slug: row.slug } : null;
}
