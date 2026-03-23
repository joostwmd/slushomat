import type { OrgAnalyticsDashboardData } from "@slushomat/ui/composite/analytics-mock-data";

export const emptyOrgAnalyticsData: OrgAnalyticsDashboardData = {
  dailyTotals: [],
  productByDay: [],
  machineTotals: [],
  entityTotals: [],
  monthlyFinancials: [],
};

export const ORG_CHART_IDS = [
  "daily-bar",
  "product-lines",
  "machine-pie",
  "product-pie",
  "entity-pie",
  "revenue-area",
] as const;

export const MACHINE_CHART_IDS = [
  "machine-daily-bar",
  "machine-product-lines",
  "machine-product-pie",
] as const;

export function allChartsLoading<T extends string>(
  ids: readonly T[],
  loading: boolean,
): Partial<Record<T, boolean>> {
  if (!loading) return {};
  return Object.fromEntries(ids.map((id) => [id, true])) as Partial<
    Record<T, boolean>
  >;
}
