/**
 * Shared Drizzle pieces for purchase analytics (Berlin calendar bucketing, contract-at-purchase share).
 * Keeps timezone + revenue-share logic in one place for MV parity and dashboard queries.
 */
import {
  and,
  count,
  desc,
  eq,
  gte,
  isNull,
  lt,
  lte,
  or,
  sql,
  sum,
} from "drizzle-orm";
import type { AnyColumn, SQL, SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@slushomat/db/schema";
import {
  analyticsPurchaseDailySummary,
  operatorContract,
  operatorContractVersion,
  purchase,
} from "@slushomat/db/schema";

/** ISO `YYYY-MM-DD` as Postgres `date` for comparisons. */
export function pgDate(isoDate: string): SQL {
  return sql`${isoDate}::date`;
}

/** UTC `purchased_at` → calendar `date` in Europe/Berlin (matches analytics MV). */
export function purchaseBerlinCalendarDate(purchasedAt: SQLWrapper): SQL {
  return sql`((${purchasedAt} at time zone 'utc') at time zone 'europe/berlin')::date`;
}

/** Berlin calendar day as `text` (`YYYY-MM-DD`) for chart buckets. */
export function purchaseBerlinDayAsText(purchasedAt: SQLWrapper): SQL<string> {
  return sql<string>`${purchaseBerlinCalendarDate(purchasedAt)}::text`;
}

/** First day of the Berlin calendar month for a Berlin calendar `date` expression. */
export function berlinCalendarMonthStart(berlinCalendarDate: SQLWrapper): SQL {
  return sql`date_trunc('month', ${berlinCalendarDate})::date`;
}

export function berlinMonthBucketAsText(
  berlinCalendarDate: SQLWrapper,
): SQL<string> {
  return sql<string>`${berlinCalendarMonthStart(berlinCalendarDate)}::text`;
}

/** Berlin calendar `date` on the base `purchase` table (WHERE / GROUP BY). */
export const purchaseBerlinDay = purchaseBerlinCalendarDate(purchase.purchasedAt);

export function mvBucketDateInRange(
  bucketDate: typeof analyticsPurchaseDailySummary.bucketDate,
  mvStart: string,
  mvEnd: string,
) {
  return and(
    gte(bucketDate, sql`${mvStart}::date`),
    lte(bucketDate, sql`${mvEnd}::date`),
  );
}

/** Platform revenue share in cents from purchase amount × contract basis points. */
export function platformShareCentsExpr(
  amountInCents: SQLWrapper,
  revenueShareBasisPoints: SQLWrapper,
): SQL {
  return sql`(${amountInCents} * ${revenueShareBasisPoints}) / 10000`;
}

/** `ON TRUE` for `INNER JOIN LATERAL … ON TRUE`. */
export const lateralJoinOnTrue = sql`true`;

/** Resolved machine label: org override → internal name → id. */
export function machineAnalyticsLabel(
  orgDisplayName: AnyColumn,
  internalName: AnyColumn,
  machineIdCol: AnyColumn,
) {
  return sql<string>`coalesce(${orgDisplayName}, ${internalName}, ${machineIdCol})`.as(
    "label",
  );
}

export type PurchaseBerlinRangeFilters = {
  organizationId?: string;
  machineId?: string;
  businessEntityId?: string;
};

/**
 * Lateral subquery: revenue-share basis points of the operator contract version
 * effective at `purchase.purchased_at` (same rule as the MV).
 */
export function contractRevenueShareBasisPointsAtPurchase(
  db: NodePgDatabase<typeof schema>,
  purchaseRow: {
    machineId: AnyColumn;
    organizationId: AnyColumn;
    purchasedAt: AnyColumn;
  },
) {
  return db
    .select({
      revenueShareBasisPoints: operatorContractVersion.revenueShareBasisPoints,
    })
    .from(operatorContract)
    .innerJoin(
      operatorContractVersion,
      eq(operatorContractVersion.entityId, operatorContract.id),
    )
    .where(
      and(
        eq(operatorContract.machineId, purchaseRow.machineId),
        eq(operatorContract.organizationId, purchaseRow.organizationId),
        lte(operatorContractVersion.effectiveDate, purchaseRow.purchasedAt),
        or(
          isNull(operatorContractVersion.endedAt),
          lt(purchaseRow.purchasedAt, operatorContractVersion.endedAt),
        ),
      ),
    )
    .orderBy(
      desc(operatorContractVersion.effectiveDate),
      desc(operatorContractVersion.versionNumber),
    )
    .limit(1)
    .as("cv");
}

/**
 * Per–Berlin-day gross, purchase count, and platform share (purchase table + contract-at-purchase).
 */
export async function sumPurchasesByBerlinDayWithPlatformShare(
  db: NodePgDatabase<typeof schema>,
  startDate: string,
  endDate: string,
  filters: PurchaseBerlinRangeFilters,
): Promise<Map<string, { gross: bigint; count: bigint; platform: bigint }>> {
  const p = alias(purchase, "p");
  const berlinDay = purchaseBerlinCalendarDate(p.purchasedAt);

  const conds = [
    gte(berlinDay, pgDate(startDate)),
    lte(berlinDay, pgDate(endDate)),
  ];
  if (filters.organizationId !== undefined) {
    conds.push(eq(p.organizationId, filters.organizationId));
  }
  if (filters.machineId !== undefined) {
    conds.push(eq(p.machineId, filters.machineId));
  }
  if (filters.businessEntityId !== undefined) {
    conds.push(eq(p.businessEntityId, filters.businessEntityId));
  }

  const cv = contractRevenueShareBasisPointsAtPurchase(db, {
    machineId: p.machineId,
    organizationId: p.organizationId,
    purchasedAt: p.purchasedAt,
  });

  const rows = await db
    .select({
      bucket: purchaseBerlinDayAsText(p.purchasedAt),
      grossCents: sum(p.amountInCents),
      purchaseCount: count(),
      platformShareCents: sum(
        platformShareCentsExpr(p.amountInCents, cv.revenueShareBasisPoints),
      ),
    })
    .from(p)
    .innerJoinLateral(cv, lateralJoinOnTrue)
    .where(and(...conds))
    .groupBy(berlinDay);

  const map = new Map<
    string,
    { gross: bigint; count: bigint; platform: bigint }
  >();
  for (const r of rows) {
    map.set(r.bucket, {
      gross: BigInt(String(r.grossCents ?? 0)),
      count: BigInt(r.purchaseCount),
      platform: BigInt(String(r.platformShareCents ?? 0)),
    });
  }
  return map;
}

/**
 * Total platform share cents over purchases in a Berlin-day range (all orgs).
 */
export async function totalPlatformShareCentsInBerlinRange(
  db: NodePgDatabase<typeof schema>,
  startDate: string,
  endDate: string,
): Promise<number> {
  const p = alias(purchase, "p");
  const berlinDay = purchaseBerlinCalendarDate(p.purchasedAt);
  const cv = contractRevenueShareBasisPointsAtPurchase(db, {
    machineId: p.machineId,
    organizationId: p.organizationId,
    purchasedAt: p.purchasedAt,
  });

  const [row] = await db
    .select({
      total: sum(
        platformShareCentsExpr(p.amountInCents, cv.revenueShareBasisPoints),
      ),
    })
    .from(p)
    .innerJoinLateral(cv, lateralJoinOnTrue)
    .where(
      and(gte(berlinDay, pgDate(startDate)), lte(berlinDay, pgDate(endDate))),
    );

  return Number(row?.total ?? 0);
}
