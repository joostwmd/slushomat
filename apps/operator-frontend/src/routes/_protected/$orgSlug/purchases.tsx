import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import { exportPurchasesToZip } from "@slushomat/ui/composite/purchases-export";
import { PurchasesTable } from "@slushomat/ui/composite/purchases-table";
import { AnalyticsDashboard } from "@slushomat/ui/composite/analytics-dashboard";
import {
  AnalyticsRangePicker,
  analyticsWindowToTrpcInput,
  defaultAnalyticsWindow,
} from "@slushomat/ui/composite/analytics-range-picker";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CpuIcon } from "lucide-react";
import { buttonVariants } from "@slushomat/ui/base/button";
import { cn } from "@slushomat/ui/lib/utils";

import {
  allChartsLoading,
  emptyOrgAnalyticsData,
  ORG_CHART_IDS,
} from "@/lib/analytics-empty-data";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/$orgSlug/purchases")({
  component: OperatorPurchasesPage,
});

function OperatorPurchasesPage() {
  const { orgSlug } = Route.useParams();
  const [filters, setFilters] = useState<{
    dateFrom?: Date;
    dateTo?: Date;
    businessEntityId?: string;
    machineId?: string;
  }>({});

  const [analyticsWindow, setAnalyticsWindow] = useState(defaultAnalyticsWindow);

  const machinesQuery = useQuery(
    trpc.operator.machine.list.queryOptions({ orgSlug }),
  );
  const entitiesQuery = useQuery(
    trpc.operator.businessEntity.list.queryOptions({ orgSlug }),
  );
  const purchasesQuery = useQuery({
    ...trpc.operator.purchase.list.queryOptions({
      orgSlug,
      startDate: filters.dateFrom,
      endDate: filters.dateTo,
      businessEntityId: filters.businessEntityId,
      machineId: filters.machineId,
      limit: 100,
    }),
  });

  const analyticsQuery = useQuery(
    trpc.operator.analytics.orgDashboard.queryOptions({
      orgSlug,
      ...analyticsWindowToTrpcInput(analyticsWindow),
      machineId: filters.machineId,
      businessEntityId: filters.businessEntityId,
    }),
  );

  const entityOptions = useMemo(
    () =>
      (entitiesQuery.data ?? []).map((e) => ({
        id: e.id,
        label: e.name,
      })),
    [entitiesQuery.data],
  );

  const machineOptions = useMemo(
    () =>
      (machinesQuery.data ?? []).map((m) => ({
        id: m.id,
        label: m.orgDisplayName,
      })),
    [machinesQuery.data],
  );

  const rows = useMemo(() => {
    const data = purchasesQuery.data ?? [];
    return data.map((r) => ({
      id: r.id,
      purchasedAt: r.purchasedAt,
      machineId: r.machineId,
      machineLabel: r.machineLabel,
      slot: r.slot,
      productName: r.productName,
      amountInCents: r.amountInCents,
      businessEntityName: r.businessEntityName,
    }));
  }, [purchasesQuery.data]);

  const handleExport = async () => {
    await exportPurchasesToZip(rows, orgSlug);
  };

  const analyticsData = analyticsQuery.data
    ? {
        dailyTotals: analyticsQuery.data.dailyTotals,
        productByDay: analyticsQuery.data.productByDay,
        machineTotals: analyticsQuery.data.machineTotals,
        entityTotals: analyticsQuery.data.entityTotals,
        monthlyFinancials: analyticsQuery.data.monthlyFinancials,
      }
    : emptyOrgAnalyticsData;

  const lastUpdated = analyticsQuery.data
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date())
    : undefined;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-xl font-medium">Purchases</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Filter sales recorded from your machines. Export the current table as a
        ZIP with CSV. Charts use the Berlin-calendar range below and share
        machine / entity filters with the table (table date range is separate).
      </p>

      {analyticsQuery.isError ? (
        <p className="mb-4 text-sm text-destructive">
          Could not load analytics.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void analyticsQuery.refetch()}
          >
            Retry
          </button>
        </p>
      ) : null}
      {analyticsQuery.data?.meta.degraded ? (
        <p className="mb-4 text-xs text-amber-700 dark:text-amber-400">
          Live purchase data only — daily summary view is temporarily
          unavailable.
        </p>
      ) : null}

      <div className="mb-10">
        <AnalyticsDashboard
          data={analyticsData}
          headerSlot={
            <AnalyticsRangePicker
              value={analyticsWindow}
              onChange={setAnalyticsWindow}
            />
          }
          lastUpdated={lastUpdated}
          chartLoading={allChartsLoading(
            ORG_CHART_IDS,
            analyticsQuery.isFetching && !analyticsQuery.data,
          )}
          onChartRetry={() => void analyticsQuery.refetch()}
        />
      </div>

      <PurchasesTable
        data={rows}
        isLoading={purchasesQuery.isPending}
        filters={filters}
        onFiltersChange={setFilters}
        onExportCsv={handleExport}
        showMachineColumn
        showEntityColumn
        entityOptions={entityOptions}
        machineOptions={machineOptions}
      />

      <section className="mt-12">
        <h2 className="mb-4 text-sm font-medium">Machines</h2>
        {machinesQuery.isPending ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (machinesQuery.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No machines linked.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(machinesQuery.data ?? []).map((m) => (
              <li key={m.id} className="flex flex-col gap-2">
                <Link
                  to="/$orgSlug/machines/$machineId"
                  params={{ orgSlug, machineId: m.id }}
                  className="block outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="h-full rounded-none border transition-colors hover:bg-muted/40">
                    <CardHeader className="space-y-1">
                      <CpuIcon className="size-5 text-muted-foreground" />
                      <CardTitle className="text-base font-medium">
                        {m.orgDisplayName}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Analytics, contract, slots, and purchases
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "px-0 text-xs",
                        )}
                      >
                        Open machine →
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
