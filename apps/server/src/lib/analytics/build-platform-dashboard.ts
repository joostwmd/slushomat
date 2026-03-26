import { and, count, desc, eq, gte, lte, sum } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@slushomat/db/schema";
import {
  analyticsPurchaseDailySummary,
  machine,
  operator,
  operatorMachineDisplayName,
  purchase,
} from "@slushomat/db/schema";

import { bigToNumber, bucketKey } from "./analytics-utils";
import { compareIsoDate, eachIsoDateInclusive } from "./date-helpers";
import {
  machineAnalyticsLabel,
  mvBucketDateInRange,
  purchaseBerlinDay,
  sumPurchasesByBerlinDayWithPlatformShare,
  totalPlatformShareCentsInBerlinRange,
} from "./purchase-analytics-drizzle";

export type PlatformDashboardPayload = {
  meta: {
    startDate: string;
    endDate: string;
    berlinToday: string;
    usedMaterializedView: boolean;
    degraded: boolean;
  };
  dailyTotals: {
    date: string;
    grossCents: number;
    purchaseCount: number;
    platformShareCents: number;
  }[];
  topOrganizations: {
    /** Operator (tenant) id. */
    organizationId: string;
    name: string;
    grossCents: number;
    purchaseCount: number;
  }[];
  machineTotals: {
    machineId: string;
    label: string;
    grossCents: number;
    purchaseCount: number;
  }[];
  totalPlatformShareCents: number;
};

async function fetchMvDailyPlatform(
  db: NodePgDatabase<typeof schema>,
  mvStart: string,
  mvEnd: string,
): Promise<Map<string, { gross: bigint; count: bigint; platform: bigint }>> {
  const map = new Map<
    string,
    { gross: bigint; count: bigint; platform: bigint }
  >();
  const rows = await db
    .select({
      d: analyticsPurchaseDailySummary.bucketDate,
      gross: sum(analyticsPurchaseDailySummary.grossAmountCents),
      cnt: sum(analyticsPurchaseDailySummary.purchaseCount),
      platform: sum(analyticsPurchaseDailySummary.platformRevenueShareCents),
    })
    .from(analyticsPurchaseDailySummary)
    .where(
      mvBucketDateInRange(
        analyticsPurchaseDailySummary.bucketDate,
        mvStart,
        mvEnd,
      ),
    )
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

export async function buildPlatformDashboard(
  db: NodePgDatabase<typeof schema>,
  input: {
    range: { startDate: string; endDate: string; berlinToday: string };
  },
): Promise<PlatformDashboardPayload> {
  const { range } = input;
  const { startDate, endDate, berlinToday } = range;
  const allDays = eachIsoDateInclusive(startDate, endDate);

  let degraded = false;
  let usedMaterializedView = false;

  const mvMap = new Map<
    string,
    { gross: bigint; count: bigint; platform: bigint }
  >();
  const purchaseMap = new Map<
    string,
    { gross: bigint; count: bigint; platform: bigint }
  >();

  const yesterday = (() => {
    const [y, m, d] = berlinToday.split("-").map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  })();

  const rangeHasPastClosedDay = compareIsoDate(startDate, berlinToday) < 0;
  const mvStart = startDate;
  const mvEnd =
    compareIsoDate(endDate, yesterday) <= 0 ? endDate : yesterday;
  const canUseMvSlice =
    rangeHasPastClosedDay && compareIsoDate(mvStart, mvEnd) <= 0;

  if (canUseMvSlice) {
    try {
      const m = await fetchMvDailyPlatform(db, mvStart, mvEnd);
      for (const [k, v] of m) mvMap.set(k, v);
      usedMaterializedView = true;
    } catch (e) {
      console.error("[analytics] platform MV failed", e);
      degraded = true;
      const pm = await sumPurchasesByBerlinDayWithPlatformShare(
        db,
        mvStart,
        mvEnd,
        {},
      );
      for (const [k, v] of pm) purchaseMap.set(k, v);
    }
  }

  const todayInRange =
    compareIsoDate(startDate, berlinToday) <= 0 &&
    compareIsoDate(endDate, berlinToday) >= 0;
  if (todayInRange) {
    const pm = await sumPurchasesByBerlinDayWithPlatformShare(
      db,
      berlinToday,
      berlinToday,
      {},
    );
    const t = pm.get(berlinToday);
    if (t) purchaseMap.set(berlinToday, t);
  }

  if (!canUseMvSlice) {
    const pm = await sumPurchasesByBerlinDayWithPlatformShare(
      db,
      startDate,
      endDate,
      {},
    );
    for (const [k, v] of pm) purchaseMap.set(k, v);
  }

  const dailyTotals = allDays.map((date) => {
    let v = { gross: 0n, count: 0n, platform: 0n };
    if (compareIsoDate(date, berlinToday) < 0) {
      v = mvMap.get(date) ?? purchaseMap.get(date) ?? v;
    } else if (date === berlinToday) {
      v = purchaseMap.get(date) ?? v;
    }
    return {
      date,
      grossCents: bigToNumber(v.gross),
      purchaseCount: bigToNumber(v.count),
      platformShareCents: bigToNumber(v.platform),
    };
  });

  const grossSum = sum(purchase.amountInCents);
  const topOrgRows = await db
    .select({
      organizationId: purchase.operatorId,
      name: operator.name,
      grossCents: grossSum,
      purchaseCount: count().as("purchaseCount"),
    })
    .from(purchase)
    .innerJoin(operator, eq(purchase.operatorId, operator.id))
    .where(
      and(gte(purchaseBerlinDay, startDate), lte(purchaseBerlinDay, endDate)),
    )
    .groupBy(purchase.operatorId, operator.name)
    .orderBy(desc(grossSum))
    .limit(20);

  const topOrganizations = topOrgRows.map((r) => ({
    organizationId: r.organizationId,
    name: r.name,
    grossCents: Number(r.grossCents ?? 0),
    purchaseCount: r.purchaseCount,
  }));

  const machineRows = await db
    .select({
      machineId: purchase.machineId,
      label: machineAnalyticsLabel(
        operatorMachineDisplayName.orgDisplayName,
        machine.internalName,
        purchase.machineId,
      ),
      gross: sum(purchase.amountInCents),
      cnt: count().as("cnt"),
    })
    .from(purchase)
    .leftJoin(machine, eq(purchase.machineId, machine.id))
    .leftJoin(
      operatorMachineDisplayName,
      and(
        eq(operatorMachineDisplayName.machineId, purchase.machineId),
        eq(operatorMachineDisplayName.operatorId, purchase.operatorId),
      ),
    )
    .where(
      and(
        gte(purchaseBerlinDay, startDate),
        lte(purchaseBerlinDay, endDate),
      ),
    )
    .groupBy(
      purchase.machineId,
      operatorMachineDisplayName.orgDisplayName,
      machine.internalName,
    );

  const machineTotals = machineRows.map((r) => ({
    machineId: r.machineId,
    label: r.label,
    grossCents: Number(r.gross ?? 0),
    purchaseCount: r.cnt,
  }));

  const totalPlatformShareCents = await totalPlatformShareCentsInBerlinRange(
    db,
    startDate,
    endDate,
  );

  return {
    meta: {
      startDate,
      endDate,
      berlinToday,
      usedMaterializedView: usedMaterializedView && !degraded,
      degraded,
    },
    dailyTotals,
    topOrganizations,
    machineTotals,
    totalPlatformShareCents,
  };
}
