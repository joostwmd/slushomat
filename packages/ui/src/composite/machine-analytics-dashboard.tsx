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

import { AnalyticsChartShell } from "./analytics-chart-shell";
import type { MachineAnalyticsDashboardData } from "./analytics-mock-data";
import { mockMachineAnalyticsData } from "./analytics-mock-data";

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function productSeriesKey(productName: string): string {
  return `p_${productName.replace(/[^a-zA-Z0-9]+/g, "_")}`;
}

function buildProductByDaySeries(
  rows: MachineAnalyticsDashboardData["productByDay"],
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

export type MachineAnalyticsDashboardProps = {
  data?: MachineAnalyticsDashboardData;
  headerSlot?: React.ReactNode;
  lastUpdated?: string;
  chartLoading?: Partial<Record<string, boolean>>;
  onChartRetry?: (chartId: string) => void;
};

export function MachineAnalyticsDashboard({
  data = mockMachineAnalyticsData,
  headerSlot,
  lastUpdated,
  chartLoading,
  onChartRetry,
}: MachineAnalyticsDashboardProps) {
  const productNames = [...new Set(data.productByDay.map((r) => r.productName))];
  const productSeries = buildProductByDaySeries(data.productByDay);
  const productLineChartConfig = productLineConfig(productNames);

  const barConfig = {
    gross: { label: "Gross", color: "var(--color-chart-1)" },
    purchases: { label: "Purchases", color: "var(--color-chart-2)" },
  } satisfies ChartConfig;

  const productPieData = data.productTotals.map((p) => ({
    name: p.name,
    value: p.grossCents,
  }));

  return (
    <Card className="gap-0 overflow-hidden">
      <CardHeader className="border-b border-border">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Machine analytics</CardTitle>
            <CardDescription>
              Data for this machine only. Hover tooltips; no table filtering.
            </CardDescription>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
            {lastUpdated ? (
              <span className="inline-flex w-fit rounded-none bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                Last updated: {lastUpdated}
              </span>
            ) : null}
            {headerSlot ? (
              <div className="flex flex-wrap items-center gap-2">{headerSlot}</div>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AnalyticsChartShell
            chartId="machine-daily-bar"
            title="Revenue & purchases per day"
            loading={chartLoading?.["machine-daily-bar"]}
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
            chartId="machine-product-lines"
            title="Purchases by product"
            loading={chartLoading?.["machine-product-lines"]}
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

          <div className="md:col-span-2">
          <AnalyticsChartShell
            chartId="machine-product-pie"
            title="Product mix (period)"
            loading={chartLoading?.["machine-product-pie"]}
            onRetry={onChartRetry}
          >
            <ChartContainer
              config={{ value: { label: "Gross", color: "var(--color-chart-1)" } }}
              className="mx-auto aspect-auto h-[280px] max-w-md"
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
                  innerRadius={52}
                  outerRadius={96}
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
