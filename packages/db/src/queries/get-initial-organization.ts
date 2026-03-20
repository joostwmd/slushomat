import { eq, asc } from "drizzle-orm";

import { db } from "../connection";
import { member, organization } from "../schema";

/** Avoid named `.prepare()` — pools + PgBouncer can reuse connections and hit Postgres `42P05` (“already exists”). */
export async function getInitialOrganization(
  userId: string,
): Promise<{ id: string; slug: string } | null> {
  const rows = await db
    .select({
      id: organization.id,
      slug: organization.slug,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt))
    .limit(1);
  const row = rows[0];
  return row ? { id: row.id, slug: row.slug } : null;
}
