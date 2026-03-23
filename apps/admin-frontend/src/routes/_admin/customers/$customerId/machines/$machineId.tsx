import { buttonVariants } from "@slushomat/ui/base/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import { MachineAnalyticsDashboard } from "@slushomat/ui/composite/machine-analytics-dashboard";
import { PurchasesTable } from "@slushomat/ui/composite/purchases-table";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { cn } from "@slushomat/ui/lib/utils";

import {
  AnalyticsTimeControls,
  localTodayIsoDate,
  type AnalyticsPeriod,
} from "@/components/analytics-time-controls";
import {
  allChartsLoading,
  emptyOrgAnalyticsData,
  MACHINE_CHART_IDS,
} from "@/lib/analytics-empty-data";
import { orgPayloadToMachineDashboardData } from "@/lib/machine-analytics-map";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute(
  "/_admin/customers/$customerId/machines/$machineId",
)({
  component: AdminMachineDetailPage,
});

function formatEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function bpToPercent(bp: number): string {
  return (bp / 100).toFixed(2);
}

function AdminMachineDetailPage() {
  const { customerId, machineId } = Route.useParams();
  const [purchaseFilters, setPurchaseFilters] = useState<{
    dateFrom?: Date;
    dateTo?: Date;
  }>({});

  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>(() => ({
    mode: "week",
    anchorDate: localTodayIsoDate(),
  }));

  const orgQuery = useQuery(
    trpc.admin.customer.get.queryOptions({ organizationId: customerId }),
  );
  const machinesQuery = useQuery(
    trpc.admin.customer.listMachines.queryOptions({
      organizationId: customerId,
    }),
  );
  const slotQuery = useQuery(
    trpc.admin.machineSlot.getConfigForMachine.queryOptions({
      organizationId: customerId,
      machineId,
    }),
  );
  const contractQuery = useQuery(
    trpc.admin.operatorContract.list.queryOptions({
      machineId,
    }),
  );
  const entitiesQuery = useQuery(
    trpc.admin.businessEntity.listByOrganization.queryOptions({
      organizationId: customerId,
    }),
  );
  const purchasesQuery = useQuery({
    ...trpc.admin.purchase.list.queryOptions({
      machineId,
      startDate: purchaseFilters.dateFrom,
      endDate: purchaseFilters.dateTo,
      limit: 100,
    }),
  });

  const analyticsQuery = useQuery(
    trpc.admin.analytics.machineDashboard.queryOptions({
      organizationId: customerId,
      machineId,
      mode: analyticsPeriod.mode,
      anchorDate: analyticsPeriod.anchorDate,
    }),
  );

  const machineRow = useMemo(
    () => (machinesQuery.data ?? []).find((m) => m.machineId === machineId),
    [machinesQuery.data, machineId],
  );

  const contract = (contractQuery.data ?? [])[0];

  const entityName = useMemo(() => {
    if (!contract) return null;
    const e = (entitiesQuery.data ?? []).find(
      (x) => x.id === contract.businessEntityId,
    );
    return e?.name ?? null;
  }, [contract, entitiesQuery.data]);

  const purchaseRows = useMemo(() => {
    const rows = purchasesQuery.data ?? [];
    return rows.map((r) => ({
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

  const org = orgQuery.data;

  const machineAnalyticsData = analyticsQuery.data
    ? orgPayloadToMachineDashboardData({
        dailyTotals: analyticsQuery.data.dailyTotals,
        productByDay: analyticsQuery.data.productByDay,
        machineTotals: analyticsQuery.data.machineTotals,
        entityTotals: analyticsQuery.data.entityTotals,
        monthlyFinancials: analyticsQuery.data.monthlyFinancials,
      })
    : orgPayloadToMachineDashboardData(emptyOrgAnalyticsData);

  const analyticsLastUpdated = analyticsQuery.data
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date())
    : undefined;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {org?.name ?? "Organization"}
          </p>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-medium">
                {machineRow?.orgDisplayName ??
                  (machineRow?.internalName.trim() || "Unnamed machine")}
              </h1>
              {machineRow ? (
                <span className="rounded-none border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  v{machineRow.versionNumber}
                </span>
              ) : null}
            </div>
            {machineRow ? (
              <p className="text-xs text-muted-foreground">
                Internal:{" "}
                <span className="text-foreground">
                  {machineRow.internalName.trim() || "—"}
                </span>
                {" · Operator org name: "}
                <span className="text-foreground">
                  {machineRow.orgDisplayName}
                </span>
              </p>
            ) : null}
          </div>
        </div>
        <Link
          to="/contracts"
          search={{ organizationId: customerId, machineId }}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Configure Contract
        </Link>
      </div>

      {analyticsQuery.isError ? (
        <p className="mb-4 text-sm text-destructive">
          Could not load machine analytics.{" "}
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
          data={machineAnalyticsData}
          headerSlot={
            <AnalyticsTimeControls
              idPrefix="admin-customer-machine"
              value={analyticsPeriod}
              onChange={setAnalyticsPeriod}
            />
          }
          lastUpdated={analyticsLastUpdated}
          chartLoading={allChartsLoading(
            MACHINE_CHART_IDS,
            analyticsQuery.isFetching && !analyticsQuery.data,
          )}
          onChartRetry={() => void analyticsQuery.refetch()}
        />
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium">Purchase log</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Date filters apply to the table only; charts use the period controls
          above.
        </p>
        <PurchasesTable
          data={purchaseRows}
          isLoading={purchasesQuery.isPending}
          filters={purchaseFilters}
          onFiltersChange={setPurchaseFilters}
          showMachineColumn={false}
          showEntityColumn={false}
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium">Slot configuration</h2>
        {slotQuery.isPending ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {(["left", "middle", "right"] as const).map((slot) => (
              <Card key={slot} className="rounded-none border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs capitalize">{slot}</CardTitle>
                  <CardDescription className="text-[10px]">
                    Assigned product
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  {slotQuery.data?.slots[slot]?.trim()
                    ? slotQuery.data.slots[slot]
                    : (
                        <span className="text-muted-foreground">Empty</span>
                      )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Contract</h2>
          <Link
            to="/contracts"
            search={{ organizationId: customerId, machineId }}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            View all contracts →
          </Link>
        </div>
        {contractQuery.isPending ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !contract ? (
          <p className="text-xs text-muted-foreground">No contract on file.</p>
        ) : (
          <Card className="rounded-none border">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-none border border-border px-2 py-0.5 text-[10px] font-medium uppercase">
                  {contract.status}
                </span>
                <CardTitle className="text-sm">Current version</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 text-xs">
              <p>
                <span className="text-muted-foreground">Effective: </span>
                {new Intl.DateTimeFormat("de-DE", {
                  dateStyle: "medium",
                }).format(contract.effectiveDate)}
              </p>
              <p>
                <span className="text-muted-foreground">Monthly rent: </span>
                {formatEur(contract.monthlyRentInCents)}
              </p>
              <p>
                <span className="text-muted-foreground">Revenue share: </span>
                {bpToPercent(contract.revenueShareBasisPoints)}%
              </p>
              <p>
                <span className="text-muted-foreground">Business entity: </span>
                {entityName ?? contract.businessEntityId}
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
