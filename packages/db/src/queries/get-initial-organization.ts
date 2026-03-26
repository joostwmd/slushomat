import { eq, asc } from "drizzle-orm";

import { db } from "../connection";
import { member, operator } from "../schema";

/** Avoid named `.prepare()` — pools + PgBouncer can reuse connections and hit Postgres `42P05` (“already exists”). */
export async function getInitialOrganization(
  userId: string,
): Promise<{ id: string; slug: string } | null> {
  const rows = await db
    .select({
      id: operator.id,
      slug: operator.slug,
    })
    .from(member)
    .innerJoin(operator, eq(member.operatorId, operator.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt))
    .limit(1);
  const row = rows[0];
  return row ? { id: row.id, slug: row.slug } : null;
}
