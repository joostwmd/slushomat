import { buttonVariants } from "@slushomat/ui/base/button";
import { exportPurchasesToZip } from "@slushomat/ui/composite/purchases-export";
import { PurchasesTable } from "@slushomat/ui/composite/purchases-table";
import { MachineAnalyticsDashboard } from "@slushomat/ui/composite/machine-analytics-dashboard";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@slushomat/ui/lib/utils";

import {
  AnalyticsTimeControls,
  localTodayIsoDate,
  type AnalyticsPeriod,
} from "@/components/analytics-time-controls";
import {
  allChartsLoading,
  MACHINE_CHART_IDS,
} from "@/lib/analytics-empty-data";
import { orgPayloadToMachineDashboardData } from "@/lib/machine-analytics-map";
import { emptyOrgAnalyticsData } from "@/lib/analytics-empty-data";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute(
  "/_protected/$orgSlug/machines/$machineId/purchases",
)({
  component: OperatorMachinePurchasesPage,
});

function OperatorMachinePurchasesPage() {
  const { orgSlug, machineId } = Route.useParams();

  const [filters, setFilters] = useState<{
    dateFrom?: Date;
    dateTo?: Date;
  }>({});

  const [period, setPeriod] = useState<AnalyticsPeriod>(() => ({
    mode: "week",
    anchorDate: localTodayIsoDate(),
  }));

  const machineQuery = useQuery({
    ...trpc.operator.machine.get.queryOptions({ orgSlug, machineId }),
    retry: false,
  });

  const purchasesQuery = useQuery({
    ...trpc.operator.purchase.list.queryOptions({
      orgSlug,
      machineId,
      startDate: filters.dateFrom,
      endDate: filters.dateTo,
      limit: 100,
    }),
    enabled: machineQuery.isSuccess,
  });

  const analyticsQuery = useQuery(
    trpc.operator.analytics.machineDashboard.queryOptions({
      orgSlug,
      machineId,
      mode: period.mode,
      anchorDate: period.anchorDate,
    }),
  );

  const purchaseRows = useMemo(() => {
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

  const handleExportPurchases = async () => {
    const m = machineQuery.data;
    const nameSlug =
      m?.orgDisplayName
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48) || "purchases";
    await exportPurchasesToZip(purchaseRows, `${orgSlug}-${nameSlug}`);
  };

  const machineData = analyticsQuery.data
    ? orgPayloadToMachineDashboardData({
        dailyTotals: analyticsQuery.data.dailyTotals,
        productByDay: analyticsQuery.data.productByDay,
        machineTotals: analyticsQuery.data.machineTotals,
        entityTotals: analyticsQuery.data.entityTotals,
        monthlyFinancials: analyticsQuery.data.monthlyFinancials,
      })
    : orgPayloadToMachineDashboardData(emptyOrgAnalyticsData);

  const lastUpdated = analyticsQuery.data
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date())
    : undefined;

  if (machineQuery.isPending) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading machine…</p>
      </div>
    );
  }

  if (machineQuery.isError || !machineQuery.data) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-destructive">Machine unavailable.</p>
        <Link
          to="/$orgSlug/purchases"
          params={{ orgSlug }}
          className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 px-0")}
        >
          ← Back to purchases
        </Link>
      </div>
    );
  }

  const m = machineQuery.data;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <Link
          to="/$orgSlug/machines/$machineId"
          params={{ orgSlug, machineId }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-4 gap-1.5 px-0 text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowLeft className="size-4" />
          Machine overview
        </Link>
        <h1 className="text-xl font-medium tracking-tight">
          Purchases — {m.orgDisplayName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Analytics and sales for this machine only (no business-entity filter).
        </p>
      </div>

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
        <MachineAnalyticsDashboard
          data={machineData}
          headerSlot={
            <AnalyticsTimeControls value={period} onChange={setPeriod} />
          }
          lastUpdated={lastUpdated}
          chartLoading={allChartsLoading(
            MACHINE_CHART_IDS,
            analyticsQuery.isFetching && !analyticsQuery.data,
          )}
          onChartRetry={() => void analyticsQuery.refetch()}
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium">Purchase log</h2>
        <PurchasesTable
          data={purchaseRows}
          isLoading={purchasesQuery.isPending}
          filters={filters}
          onFiltersChange={setFilters}
          onExportCsv={handleExportPurchases}
          showMachineColumn={false}
          showEntityColumn={false}
        />
      </section>
    </div>
  );
}
