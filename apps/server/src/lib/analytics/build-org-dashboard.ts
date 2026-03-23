import { and, count, eq, gte, isNotNull, lte, sum } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { TRPCError } from "@trpc/server";

import type * as schema from "@slushomat/db/schema";
import {
  analyticsPurchaseDailySummary,
  businessEntity,
  machine,
  operatorContract,
  operatorProduct,
  organizationMachineDisplayName,
  purchase,
} from "@slushomat/db/schema";

import { bigToNumber, bucketKey } from "./analytics-utils";
import type { AnalyticsMode } from "./berlin-range";
import { compareIsoDate, eachIsoDateInclusive } from "./date-helpers";
import {
  berlinCalendarMonthStart,
  berlinMonthBucketAsText,
  contractRevenueShareBasisPointsAtPurchase,
  lateralJoinOnTrue,
  machineAnalyticsLabel,
  mvBucketDateInRange,
  pgDate,
  platformShareCentsExpr,
  purchaseBerlinCalendarDate,
  purchaseBerlinDay,
  purchaseBerlinDayAsText,
  sumPurchasesByBerlinDayWithPlatformShare,
} from "./purchase-analytics-drizzle";

export type OrgDashboardFilters = {
  organizationId: string;
  mode: AnalyticsMode;
  anchorDate: string;
  range: { startDate: string; endDate: string; berlinToday: string };
  machineId?: string;
  businessEntityId?: string;
  machineScope: boolean;
};

export type DailyBucket = {
  date: string;
  grossCents: number;
  purchaseCount: number;
  platformShareCents: number;
};

export type ProductDayPoint = {
  operatorProductId: string;
  productName: string;
  date: string;
  grossCents: number;
  purchaseCount: number;
};

export type MachineSlice = {
  machineId: string;
  label: string;
  grossCents: number;
  purchaseCount: number;
};

export type EntitySlice = {
  businessEntityId: string;
  name: string;
  grossCents: number;
  purchaseCount: number;
};

export type MonthlyFinancial = {
  monthStart: string;
  grossCents: number;
  platformShareCents: number;
  rentCents: number;
};

export type OrgDashboardPayload = {
  meta: {
    mode: AnalyticsMode;
    anchorDate: string;
    startDate: string;
    endDate: string;
    berlinToday: string;
    usedMaterializedView: boolean;
    degraded: boolean;
  };
  dailyTotals: DailyBucket[];
  productByDay: ProductDayPoint[];
  machineTotals: MachineSlice[];
  entityTotals: EntitySlice[];
  monthlyFinancials: MonthlyFinancial[];
};

export async function assertMachineBelongsToOrg(
  db: NodePgDatabase<typeof schema>,
  organizationId: string,
  machineId: string,
): Promise<void> {
  const row = await db
    .select({ id: operatorContract.id })
    .from(operatorContract)
    .where(
      and(
        eq(operatorContract.organizationId, organizationId),
        eq(operatorContract.machineId, machineId),
      ),
    )
    .limit(1);
  if (row.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Machine not found for this organization",
    });
  }
}

async function fetchDailyFromMv(
  db: NodePgDatabase<typeof schema>,
  orgId: string,
  mvStart: string,
  mvEnd: string,
  machineId?: string,
): Promise<Map<string, { gross: bigint; count: bigint; platform: bigint }>> {
  const map = new Map<
    string,
    { gross: bigint; count: bigint; platform: bigint }
  >();
  const conds = [
    eq(analyticsPurchaseDailySummary.organizationId, orgId),
    mvBucketDateInRange(
      analyticsPurchaseDailySummary.bucketDate,
      mvStart,
      mvEnd,
    ),
  ];
  if (machineId) {
    conds.push(eq(analyticsPurchaseDailySummary.machineId, machineId));
  }
  const rows = await db
    .select({
      d: analyticsPurchaseDailySummary.bucketDate,
      gross: sum(analyticsPurchaseDailySummary.grossAmountCents),
      cnt: sum(analyticsPurchaseDailySummary.purchaseCount),
      platform: sum(analyticsPurchaseDailySummary.platformRevenueShareCents),
    })
    .from(analyticsPurchaseDailySummary)
    .where(and(...conds))
    .groupBy(analyticsPurchaseDailySummary.bucketDate);

  for (const r of rows) {
    map.set(bucketKey(r.d), {
      gross: BigInt(r.gross ?? 0),
      count: BigInt(r.cnt ?? 0),
      platform: BigInt(r.platform ?? 0),
    });
  }
  return map;
}

export async function buildOrgDashboard(
  db: NodePgDatabase<typeof schema>,
  input: OrgDashboardFilters,
): Promise<OrgDashboardPayload> {
  const {
    organizationId,
    mode,
    anchorDate,
    range,
    machineId,
    businessEntityId,
    machineScope,
  } = input;

  if (machineScope && businessEntityId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "businessEntityId is not allowed for machine-scoped analytics",
    });
  }

  if (machineId) {
    await assertMachineBelongsToOrg(db, organizationId, machineId);
  }

  const { startDate, endDate, berlinToday } = range;
  const allDays = eachIsoDateInclusive(startDate, endDate);

  let degraded = false;
  let usedMaterializedView = false;

  const mvMap = new Map<
    string,
    { gross: bigint; count: bigint; platform: bigint }
  >();
  const purchaseFallback = new Map<
    string,
    { gross: bigint; count: bigint; platform: bigint }
  >();

  const yesterday = (() => {
    const [y, m, d] = berlinToday.split("-").map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  })();

  const rangeHasPastClosedDay =
    compareIsoDate(startDate, berlinToday) < 0;
  const mvStart = startDate;
  const mvEnd =
    compareIsoDate(endDate, yesterday) <= 0 ? endDate : yesterday;
  const canUseMvSlice =
    !businessEntityId &&
    rangeHasPastClosedDay &&
    compareIsoDate(mvStart, mvEnd) <= 0;

  if (businessEntityId) {
    const pm = await sumPurchasesByBerlinDayWithPlatformShare(
      db,
      startDate,
      endDate,
      { organizationId, machineId, businessEntityId },
    );
    for (const [k, v] of pm) purchaseFallback.set(k, v);
  } else if (canUseMvSlice) {
    try {
      const m = await fetchDailyFromMv(
        db,
        organizationId,
        mvStart,
        mvEnd,
        machineId,
      );
      for (const [k, v] of m) mvMap.set(k, v);
      usedMaterializedView = true;
    } catch (e) {
      console.error("[analytics] MV query failed, using purchase only", e);
      degraded = true;
      const pm = await sumPurchasesByBerlinDayWithPlatformShare(
        db,
        mvStart,
        mvEnd,
        { organizationId, machineId },
      );
      for (const [k, v] of pm) purchaseFallback.set(k, v);
    }
  }

  const todayInRange =
    compareIsoDate(startDate, berlinToday) <= 0 &&
    compareIsoDate(endDate, berlinToday) >= 0;
  if (todayInRange && !businessEntityId) {
    const pm = await sumPurchasesByBerlinDayWithPlatformShare(
      db,
      berlinToday,
      berlinToday,
      { organizationId, machineId },
    );
    const t = pm.get(berlinToday);
    if (t) purchaseFallback.set(berlinToday, t);
  }
  if (todayInRange && businessEntityId) {
    const pm = await sumPurchasesByBerlinDayWithPlatformShare(
      db,
      berlinToday,
      berlinToday,
      { organizationId, machineId, businessEntityId },
    );
    const t = pm.get(berlinToday);
    if (t) purchaseFallback.set(berlinToday, t);
  }

  if (!canUseMvSlice && !businessEntityId) {
    const pm = await sumPurchasesByBerlinDayWithPlatformShare(
      db,
      startDate,
      endDate,
      { organizationId, machineId },
    );
    for (const [k, v] of pm) purchaseFallback.set(k, v);
  }

  const dailyTotals: DailyBucket[] = allDays.map((date) => {
    let v = { gross: 0n, count: 0n, platform: 0n };
    if (compareIsoDate(date, berlinToday) < 0) {
      v = mvMap.get(date) ?? purchaseFallback.get(date) ?? v;
    } else if (date === berlinToday) {
      v = purchaseFallback.get(date) ?? v;
    }
    return {
      date,
      grossCents: bigToNumber(v.gross),
      purchaseCount: bigToNumber(v.count),
      platformShareCents: bigToNumber(v.platform),
    };
  });

  const productConds = [
    eq(purchase.organizationId, organizationId),
    gte(purchaseBerlinDay, startDate),
    lte(purchaseBerlinDay, endDate),
  ];
  if (machineId) productConds.push(eq(purchase.machineId, machineId));
  if (businessEntityId)
    productConds.push(eq(purchase.businessEntityId, businessEntityId));

  const productRows = await db
    .select({
      productId: purchase.operatorProductId,
      productName: operatorProduct.name,
      bucket: purchaseBerlinDayAsText(purchase.purchasedAt).as("bucket"),
      gross: sum(purchase.amountInCents),
      cnt: count().as("cnt"),
    })
    .from(purchase)
    .innerJoin(
      operatorProduct,
      eq(purchase.operatorProductId, operatorProduct.id),
    )
    .where(and(...productConds))
    .groupBy(
      purchase.operatorProductId,
      operatorProduct.name,
      purchaseBerlinDay,
    );

  const productByDay: ProductDayPoint[] = productRows.map((r) => ({
    operatorProductId: r.productId,
    productName: r.productName,
    date: r.bucket,
    grossCents: Number(r.gross ?? 0),
    purchaseCount: r.cnt,
  }));

  const machineConds = [
    eq(purchase.organizationId, organizationId),
    gte(purchaseBerlinDay, startDate),
    lte(purchaseBerlinDay, endDate),
  ];
  if (machineId) machineConds.push(eq(purchase.machineId, machineId));
  if (businessEntityId)
    machineConds.push(eq(purchase.businessEntityId, businessEntityId));

  const machineRows = await db
    .select({
      machineId: purchase.machineId,
      label: machineAnalyticsLabel(
        organizationMachineDisplayName.orgDisplayName,
        machine.internalName,
        purchase.machineId,
      ),
      gross: sum(purchase.amountInCents),
      cnt: count().as("cnt"),
    })
    .from(purchase)
    .leftJoin(machine, eq(purchase.machineId, machine.id))
    .leftJoin(
      organizationMachineDisplayName,
      and(
        eq(organizationMachineDisplayName.machineId, purchase.machineId),
        eq(
          organizationMachineDisplayName.organizationId,
          purchase.organizationId,
        ),
      ),
    )
    .where(and(...machineConds))
    .groupBy(
      purchase.machineId,
      organizationMachineDisplayName.orgDisplayName,
      machine.internalName,
    );

  const machineTotals: MachineSlice[] = machineRows.map((r) => ({
    machineId: r.machineId,
    label: r.label,
    grossCents: Number(r.gross ?? 0),
    purchaseCount: r.cnt,
  }));

  const entityConds = [
    eq(purchase.organizationId, organizationId),
    gte(purchaseBerlinDay, startDate),
    lte(purchaseBerlinDay, endDate),
    isNotNull(purchase.businessEntityId),
  ];
  if (machineId) entityConds.push(eq(purchase.machineId, machineId));
  if (businessEntityId)
    entityConds.push(eq(purchase.businessEntityId, businessEntityId));

  const entityRows = await db
    .select({
      businessEntityId: purchase.businessEntityId,
      name: businessEntity.name,
      gross: sum(purchase.amountInCents),
      cnt: count().as("cnt"),
    })
    .from(purchase)
    .innerJoin(
      businessEntity,
      eq(purchase.businessEntityId, businessEntity.id),
    )
    .where(and(...entityConds))
    .groupBy(purchase.businessEntityId, businessEntity.name);

  const entityTotals: EntitySlice[] = entityRows
    .filter((r) => r.businessEntityId)
    .map((r) => ({
      businessEntityId: r.businessEntityId!,
      name: r.name,
      grossCents: Number(r.gross ?? 0),
      purchaseCount: r.cnt,
    }));

  const pMonth = alias(purchase, "p");
  const berlinDayMonth = purchaseBerlinCalendarDate(pMonth.purchasedAt);
  const monthBucket = berlinCalendarMonthStart(berlinDayMonth);

  const monthlyConds = [
    eq(pMonth.organizationId, organizationId),
    gte(berlinDayMonth, pgDate(startDate)),
    lte(berlinDayMonth, pgDate(endDate)),
  ];
  if (machineId) monthlyConds.push(eq(pMonth.machineId, machineId));
  if (businessEntityId)
    monthlyConds.push(eq(pMonth.businessEntityId, businessEntityId));

  const contractAtPurchaseMonth = contractRevenueShareBasisPointsAtPurchase(
    db,
    {
      machineId: pMonth.machineId,
      organizationId: pMonth.organizationId,
      purchasedAt: pMonth.purchasedAt,
    },
  );

  const monthlyRows = await db
    .select({
      monthStart: berlinMonthBucketAsText(berlinDayMonth),
      grossCents: sum(pMonth.amountInCents),
      platformShareCents: sum(
        platformShareCentsExpr(
          pMonth.amountInCents,
          contractAtPurchaseMonth.revenueShareBasisPoints,
        ),
      ),
    })
    .from(pMonth)
    .innerJoinLateral(contractAtPurchaseMonth, lateralJoinOnTrue)
    .where(and(...monthlyConds))
    .groupBy(monthBucket)
    .orderBy(monthBucket);

  const monthlyFinancials: MonthlyFinancial[] = monthlyRows.map((r) => ({
    monthStart: r.monthStart,
    grossCents: Number(r.grossCents ?? 0),
    platformShareCents: Number(r.platformShareCents ?? 0),
    rentCents: 0,
  }));

  return {
    meta: {
      mode,
      anchorDate,
      startDate,
      endDate,
      berlinToday,
      usedMaterializedView: usedMaterializedView && !degraded,
      degraded,
    },
    dailyTotals,
    productByDay,
    machineTotals,
    entityTotals,
    monthlyFinancials,
  };
}
