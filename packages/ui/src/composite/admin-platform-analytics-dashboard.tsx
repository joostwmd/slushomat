import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@slushomat/ui/base/chart";
import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  hasDailyBarData,
  hasGrossTotalsData,
} from "../lib/analytics-chart-has-data";
import { AnalyticsChartShell } from "./analytics-chart-shell";
import type { AdminPlatformAnalyticsDashboardData } from "./analytics-mock-data";
import { mockAdminPlatformAnalyticsData } from "./analytics-mock-data";

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const pieColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function revenueShareBreakdown(
  data: AdminPlatformAnalyticsDashboardData,
): { name: string; value: number }[] {
  const grossWindow = data.dailyTotals.reduce((s, d) => s + d.grossCents, 0);
  const platform = data.totalPlatformShareCents;
  const rentEstimate = Math.round(platform * 0.08);
  const operatorEst = Math.max(0, grossWindow - platform - rentEstimate);
  return [
    { name: "Platform share", value: platform },
    { name: "Rent (est.)", value: rentEstimate },
    { name: "Operator pool (est.)", value: operatorEst },
  ].filter((x) => x.value > 0);
}

export type AdminPlatformAnalyticsDashboardProps = {
  data?: AdminPlatformAnalyticsDashboardData;
  headerSlot?: React.ReactNode;
  lastUpdated?: string;
  chartLoading?: Partial<Record<string, boolean>>;
  onChartRetry?: (chartId: string) => void;
};

export function AdminPlatformAnalyticsDashboard({
  data = mockAdminPlatformAnalyticsData,
  headerSlot,
  lastUpdated,
  chartLoading,
  onChartRetry,
}: AdminPlatformAnalyticsDashboardProps) {
  const trendConfig = {
    gross: { label: "Gross", color: "var(--color-chart-1)" },
  } satisfies ChartConfig;

  const topOrgChartData = data.topOrganizations.map((o) => ({
    name: o.name.length > 18 ? `${o.name.slice(0, 16)}…` : o.name,
    grossCents: o.grossCents,
    purchases: o.purchaseCount,
  }));

  const topOrgConfig = {
    grossCents: { label: "Gross", color: "var(--color-chart-2)" },
  } satisfies ChartConfig;

  const machineUtilData = data.machineTotals.map((m) => ({
    name: m.label.length > 14 ? `${m.label.slice(0, 12)}…` : m.label,
    purchases: m.purchaseCount,
    grossCents: m.grossCents,
  }));

  const machineConfig = {
    purchases: { label: "Purchases", color: "var(--color-chart-3)" },
  } satisfies ChartConfig;

  const sharePie = revenueShareBreakdown(data);

  const platformTrendEmpty = !hasDailyBarData(data.dailyTotals);
  const topOrgsEmpty = !hasGrossTotalsData(data.topOrganizations);
  const machineUtilEmpty = !hasDailyBarData(data.machineTotals);
  const revenueShareEmpty = sharePie.length === 0;

  return (
    <Card className="gap-0 overflow-hidden">
      <CardHeader className="gap-0 space-y-0 border-b border-border pb-0">
        <div className="space-y-2 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle>Platform analytics</CardTitle>
            {lastUpdated ? (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                Updated {lastUpdated}
              </span>
            ) : null}
          </div>
          <CardDescription>
            Cross-customer totals. Hover charts for values; charts don’t filter
            tables.
          </CardDescription>
        </div>
        {headerSlot ? (
          <div className="-mx-4 border-t border-border bg-muted/25 px-4 py-3">
            {headerSlot}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AnalyticsChartShell
            chartId="platform-trend"
            title="Platform revenue trend"
            description="Gross sales across all customers (window shown)."
            empty={platformTrendEmpty}
            emptyDescription="No platform revenue in this period."
            loading={chartLoading?.["platform-trend"]}
            onRetry={onChartRetry}
          >
            <ChartContainer config={trendConfig} className="aspect-auto h-[280px]">
              <LineChart data={data.dailyTotals}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCents(Number(v))}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="tabular-nums">
                          {formatCents(Number(value))}
                        </span>
                      )}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="grossCents"
                  name="gross"
                  stroke="var(--color-gross)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </AnalyticsChartShell>

          <AnalyticsChartShell
            chartId="top-orgs"
            title="Top organizations"
            description="Gross volume in the selected period (mock until API wiring)."
            empty={topOrgsEmpty}
            emptyDescription="No organization volume in this period."
            loading={chartLoading?.["top-orgs"]}
            onRetry={onChartRetry}
          >
            <ChartContainer config={topOrgConfig} className="aspect-auto h-[280px]">
              <BarChart
                data={topOrgChartData}
                layout="vertical"
                margin={{ left: 8, right: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCents(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="tabular-nums">
                          {formatCents(Number(value))}
                        </span>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="grossCents"
                  name="grossCents"
                  fill="var(--color-grossCents)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </AnalyticsChartShell>

          <AnalyticsChartShell
            chartId="machine-util"
            title="Machine utilization (sample)"
            description="Purchase counts by machine label (proxy for utilization)."
            empty={machineUtilEmpty}
            emptyDescription="No machine activity in this period."
            loading={chartLoading?.["machine-util"]}
            onRetry={onChartRetry}
          >
            <ChartContainer config={machineConfig} className="aspect-auto h-[280px]">
              <BarChart data={machineUtilData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="purchases"
                  name="purchases"
                  fill="var(--color-purchases)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </AnalyticsChartShell>

          <AnalyticsChartShell
            chartId="revenue-share"
            title="Revenue share breakdown (est.)"
            description="Illustrative split from platform totals and window gross (T03 will use real allocations)."
            empty={revenueShareEmpty}
            emptyDescription="Not enough data to estimate revenue share for this period."
            loading={chartLoading?.["revenue-share"]}
            onRetry={onChartRetry}
          >
            <ChartContainer
              config={{ value: { label: "Amount", color: "var(--color-chart-1)" } }}
              className="aspect-auto h-[280px]"
            >
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCents(Number(value))}
                    />
                  }
                />
                <Pie
                  data={sharePie}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {sharePie.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ChartContainer>
          </AnalyticsChartShell>
        </div>
      </CardContent>
    </Card>
  );
}
