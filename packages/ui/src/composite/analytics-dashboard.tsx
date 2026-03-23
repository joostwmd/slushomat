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
  Area,
  AreaChart,
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
  hasMonthlyFinancialsData,
  hasPositivePieValues,
  hasProductByDayData,
} from "../lib/analytics-chart-has-data";
import { AnalyticsChartShell } from "./analytics-chart-shell";
import type { OrgAnalyticsDashboardData } from "./analytics-mock-data";
import { mockOrgAnalyticsData } from "./analytics-mock-data";

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Safe `dataKey` + CSS token suffix (no spaces). */
function productSeriesKey(productName: string): string {
  return `p_${productName.replace(/[^a-zA-Z0-9]+/g, "_")}`;
}

function buildProductByDaySeries(
  rows: OrgAnalyticsDashboardData["productByDay"],
): { date: string; [key: string]: string | number }[] {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const names = [...new Set(rows.map((r) => r.productName))];
  return dates.map((date) => {
    const point: { date: string; [key: string]: string | number } = { date };
    for (const n of names) point[productSeriesKey(n)] = 0;
    for (const r of rows) {
      if (r.date === date) {
        const k = productSeriesKey(r.productName);
        point[k] = (point[k] as number) + r.grossCents;
      }
    }
    return point;
  });
}

function productLineConfig(names: string[]): ChartConfig {
  const colors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];
  const config: ChartConfig = {};
  names.forEach((name, i) => {
    config[productSeriesKey(name)] = {
      label: name,
      color: colors[i % colors.length]!,
    };
  });
  return config;
}

const pieColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export type AnalyticsDashboardProps = {
  /** Chart-ready payload; defaults to `mockOrgAnalyticsData` until wired to API. */
  data?: OrgAnalyticsDashboardData;
  /** Optional slot for time controls (Daily / Weekly / Monthly, calendar, etc.). */
  headerSlot?: React.ReactNode;
  lastUpdated?: string;
  /** Per-chart loading (sparse keys OK). */
  chartLoading?: Partial<Record<string, boolean>>;
  onChartRetry?: (chartId: string) => void;
};

export function AnalyticsDashboard({
  data = mockOrgAnalyticsData,
  headerSlot,
  lastUpdated,
  chartLoading,
  onChartRetry,
}: AnalyticsDashboardProps) {
  const productNames = [...new Set(data.productByDay.map((r) => r.productName))];
  const productSeries = buildProductByDaySeries(data.productByDay);
  const productLineChartConfig = productLineConfig(productNames);

  const barConfig = {
    gross: { label: "Gross", color: "var(--color-chart-1)" },
    purchases: { label: "Purchases", color: "var(--color-chart-2)" },
  } satisfies ChartConfig;

  const areaConfig = {
    gross: { label: "Gross revenue", color: "var(--color-chart-1)" },
    platform: { label: "Platform share", color: "var(--color-chart-3)" },
    rent: { label: "Rent", color: "var(--color-chart-5)" },
  } satisfies ChartConfig;

  const machinePieData = data.machineTotals.map((m) => ({
    name: m.label,
    value: m.grossCents,
  }));

  const productPieData = data.productByDay.reduce<
    { name: string; value: number }[]
  >((acc, r) => {
    const existing = acc.find((x) => x.name === r.productName);
    if (existing) existing.value += r.grossCents;
    else acc.push({ name: r.productName, value: r.grossCents });
    return acc;
  }, []);

  const entityPieData = data.entityTotals.map((e) => ({
    name: e.name,
    value: e.grossCents,
  }));

  const dailyChartEmpty = !hasDailyBarData(data.dailyTotals);
  const productLinesEmpty = !hasProductByDayData(data.productByDay);
  const machinePieEmpty = !hasGrossTotalsData(data.machineTotals);
  const productPieEmpty = !hasPositivePieValues(
    productPieData.map((p) => p.value),
  );
  const entityPieEmpty = !hasGrossTotalsData(data.entityTotals);
  const revenueAreaEmpty = !hasMonthlyFinancialsData(data.monthlyFinancials);

  return (
    <Card className="gap-0 overflow-hidden">
      <CardHeader className="gap-0 space-y-0 border-b border-border pb-0">
        <div className="space-y-2 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle>Analytics</CardTitle>
            {lastUpdated ? (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                Updated {lastUpdated}
              </span>
            ) : null}
          </div>
          <CardDescription>
            Revenue and mix for the selected period. Charts don’t filter the table.
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
            chartId="daily-bar"
            title="Revenue & purchases per day"
            description="Gross sales in EUR; bar height reflects purchase count scale (secondary axis)."
            empty={dailyChartEmpty}
            emptyDescription="No revenue or purchases in this period."
            loading={chartLoading?.["daily-bar"]}
            onRetry={onChartRetry}
          >
            <ChartContainer config={barConfig} className="aspect-auto h-[280px]">
              <BarChart data={data.dailyTotals}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCents(Number(v))}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <span className="tabular-nums">
                          {name === "gross" || name === "Gross"
                            ? formatCents(Number(value))
                            : String(value)}
                        </span>
                      )}
                    />
                  }
                />
                <Bar
                  yAxisId="left"
                  dataKey="grossCents"
                  name="gross"
                  fill="var(--color-gross)"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  yAxisId="right"
                  dataKey="purchaseCount"
                  name="purchases"
                  fill="var(--color-purchases)"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </AnalyticsChartShell>

          <AnalyticsChartShell
            chartId="product-lines"
            title="Purchases by product"
            description="Gross cents per product per day."
            empty={productLinesEmpty}
            emptyDescription="No product-level sales in this period."
            loading={chartLoading?.["product-lines"]}
            onRetry={onChartRetry}
          >
            <ChartContainer
              config={productLineChartConfig}
              className="aspect-auto h-[280px]"
            >
              <LineChart data={productSeries}>
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
                <Legend />
                {productNames.map((name) => {
                  const key = productSeriesKey(name);
                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={`var(--color-${key})`}
                      strokeWidth={2}
                      dot={false}
                    />
                  );
                })}
              </LineChart>
            </ChartContainer>
          </AnalyticsChartShell>

          <AnalyticsChartShell
            chartId="machine-pie"
            title="Sales by machine"
            empty={machinePieEmpty}
            emptyDescription="No machine sales in this period."
            loading={chartLoading?.["machine-pie"]}
            onRetry={onChartRetry}
          >
            <ChartContainer
              config={{ value: { label: "Gross", color: "var(--color-chart-1)" } }}
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
                  data={machinePieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {machinePieData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ChartContainer>
          </AnalyticsChartShell>

          <AnalyticsChartShell
            chartId="product-pie"
            title="Sales by product"
            empty={productPieEmpty}
            emptyDescription="No product sales in this period."
            loading={chartLoading?.["product-pie"]}
            onRetry={onChartRetry}
          >
            <ChartContainer
              config={{ value: { label: "Gross", color: "var(--color-chart-2)" } }}
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
                  data={productPieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {productPieData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ChartContainer>
          </AnalyticsChartShell>

          <AnalyticsChartShell
            chartId="entity-pie"
            title="Sales by business entity"
            empty={entityPieEmpty}
            emptyDescription="No entity-level sales in this period."
            loading={chartLoading?.["entity-pie"]}
            onRetry={onChartRetry}
          >
            <ChartContainer
              config={{ value: { label: "Gross", color: "var(--color-chart-3)" } }}
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
                  data={entityPieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {entityPieData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ChartContainer>
          </AnalyticsChartShell>

          <AnalyticsChartShell
            chartId="revenue-area"
            title="Revenue vs costs (monthly)"
            description="Gross revenue, platform share, and rent (mock rent where unavailable)."
            empty={revenueAreaEmpty}
            emptyDescription="No monthly financial data to show yet."
            loading={chartLoading?.["revenue-area"]}
            onRetry={onChartRetry}
          >
            <ChartContainer config={areaConfig} className="aspect-auto h-[280px]">
              <AreaChart data={data.monthlyFinancials}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="monthStart" tickLine={false} axisLine={false} />
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
                <Legend />
                <Area
                  type="monotone"
                  dataKey="grossCents"
                  name="gross"
                  stroke="var(--color-gross)"
                  fill="var(--color-gross)"
                  fillOpacity={0.28}
                />
                <Area
                  type="monotone"
                  dataKey="platformShareCents"
                  name="platform"
                  stroke="var(--color-platform)"
                  fill="var(--color-platform)"
                  fillOpacity={0.32}
                />
                <Area
                  type="monotone"
                  dataKey="rentCents"
                  name="rent"
                  stroke="var(--color-rent)"
                  fill="var(--color-rent)"
                  fillOpacity={0.4}
                />
              </AreaChart>
            </ChartContainer>
          </AnalyticsChartShell>
        </div>
      </CardContent>
    </Card>
  );
}
