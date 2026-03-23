import type {
  MachineAnalyticsDashboardData,
  OrgAnalyticsDashboardData,
} from "@slushomat/ui/composite/analytics-mock-data";

/** Roll up product-by-day rows for the machine pie chart. */
export function productTotalsFromByDay(
  rows: OrgAnalyticsDashboardData["productByDay"],
): MachineAnalyticsDashboardData["productTotals"] {
  const map = new Map<
    string,
    { name: string; grossCents: number; purchaseCount: number }
  >();
  for (const r of rows) {
    const cur = map.get(r.productName) ?? {
      name: r.productName,
      grossCents: 0,
      purchaseCount: 0,
    };
    cur.grossCents += r.grossCents;
    cur.purchaseCount += r.purchaseCount;
    map.set(r.productName, cur);
  }
  return [...map.values()];
}

export function orgPayloadToMachineDashboardData(
  payload: OrgAnalyticsDashboardData,
): MachineAnalyticsDashboardData {
  return {
    dailyTotals: payload.dailyTotals,
    productByDay: payload.productByDay,
    productTotals: productTotalsFromByDay(payload.productByDay),
  };
}
