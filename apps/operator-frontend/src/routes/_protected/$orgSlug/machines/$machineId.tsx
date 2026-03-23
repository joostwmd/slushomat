import { Button, buttonVariants } from "@slushomat/ui/base/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@slushomat/ui/base/empty";
import { Input } from "@slushomat/ui/base/input";
import { Label } from "@slushomat/ui/base/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@slushomat/ui/base/select";
import { exportPurchasesToZip } from "@slushomat/ui/composite/purchases-export";
import { MachineAnalyticsDashboard } from "@slushomat/ui/composite/machine-analytics-dashboard";
import {
  AnalyticsRangePicker,
  analyticsWindowToTrpcInput,
  defaultAnalyticsWindow,
} from "@slushomat/ui/composite/analytics-range-picker";
import { PurchasesTable } from "@slushomat/ui/composite/purchases-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@slushomat/ui/lib/utils";

import {
  allChartsLoading,
  emptyOrgAnalyticsData,
  MACHINE_CHART_IDS,
} from "@/lib/analytics-empty-data";
import { orgPayloadToMachineDashboardData } from "@/lib/machine-analytics-map";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute(
  "/_protected/$orgSlug/machines/$machineId",
)({
  component: OperatorMachineDetailPage,
});

const SLOT_EMPTY = "__slot_empty__";

type SlotsState = {
  left: string | null;
  middle: string | null;
  right: string | null;
};

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

function isNoOpenDeploymentError(e: unknown): boolean {
  return errMessage(e).includes("No open deployment");
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function bpToPercent(bp: number): string {
  return (bp / 100).toFixed(2);
}

function OperatorMachineDetailPage() {
  const { orgSlug, machineId } = Route.useParams();
  const queryClient = useQueryClient();

  const [slotsDraft, setSlotsDraft] = useState<SlotsState | null>(null);
  const [purchaseFilters, setPurchaseFilters] = useState<{
    dateFrom?: Date;
    dateTo?: Date;
  }>({});

  const [orgDisplayNameDraft, setOrgDisplayNameDraft] = useState("");
  const [analyticsWindow, setAnalyticsWindow] = useState(defaultAnalyticsWindow);

  const machineQuery = useQuery({
    ...trpc.operator.machine.get.queryOptions({ orgSlug, machineId }),
    retry: false,
  });

  const contractQuery = useQuery(
    trpc.operator.operatorContract.list.queryOptions({
      orgSlug,
      machineId,
    }),
  );

  const entitiesQuery = useQuery(
    trpc.operator.businessEntity.list.queryOptions({ orgSlug }),
  );

  const purchasesQuery = useQuery({
    ...trpc.operator.purchase.list.queryOptions({
      orgSlug,
      machineId,
      startDate: purchaseFilters.dateFrom,
      endDate: purchaseFilters.dateTo,
      limit: 100,
    }),
    enabled: machineQuery.isSuccess,
  });

  const analyticsQuery = useQuery({
    ...trpc.operator.analytics.machineDashboard.queryOptions({
      orgSlug,
      machineId,
      ...analyticsWindowToTrpcInput(analyticsWindow),
    }),
    enabled: machineQuery.isSuccess,
  });

  const productsQuery = useQuery(
    trpc.operator.product.list.queryOptions({ orgSlug }),
  );

  const configQuery = useQuery({
    ...trpc.operator.machineSlot.getConfigForMachine.queryOptions({
      orgSlug,
      machineId,
    }),
    enabled: machineQuery.isSuccess,
    retry: false,
  });

  useEffect(() => {
    if (configQuery.data) {
      setSlotsDraft({ ...configQuery.data.slots });
    }
  }, [configQuery.data]);

  useEffect(() => {
    if (machineQuery.data) {
      setOrgDisplayNameDraft(machineQuery.data.orgDisplayName);
    }
  }, [machineQuery.data]);

  const setSlotsMutation = useMutation({
    ...trpc.operator.machineSlot.setSlots.mutationOptions(),
    onSuccess: () => {
      toast.success("Slot configuration saved");
      void queryClient.invalidateQueries(
        trpc.operator.machineSlot.getConfigForMachine.queryFilter({
          orgSlug,
          machineId,
        }),
      );
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const setOrgDisplayNameMutation = useMutation({
    ...trpc.operator.machine.setOrgDisplayName.mutationOptions(),
    onSuccess: () => {
      toast.success("Machine name updated");
      void queryClient.invalidateQueries(
        trpc.operator.machine.list.queryFilter({ orgSlug }),
      );
      void queryClient.invalidateQueries(
        trpc.operator.machine.get.queryFilter({ orgSlug, machineId }),
      );
      void queryClient.invalidateQueries(
        trpc.operator.purchase.list.queryFilter({ orgSlug }),
      );
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const handleSave = () => {
    if (!slotsDraft) {
      toast.error("Slot configuration is still loading");
      return;
    }
    setSlotsMutation.mutate({
      orgSlug,
      machineId,
      slots: slotsDraft,
    });
  };

  const contract = (contractQuery.data ?? [])[0];

  const entityName = useMemo(() => {
    if (!contract) return null;
    const e = (entitiesQuery.data ?? []).find(
      (x) => x.id === contract.businessEntityId,
    );
    return e?.name ?? null;
  }, [contract, entitiesQuery.data]);

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

  const products = productsQuery.data ?? [];

  const productSlotSelectItems = useMemo(() => {
    const items: Record<string, ReactNode> = {
      [SLOT_EMPTY]: "— Empty —",
    };
    for (const p of products) {
      items[p.id] = p.name;
    }
    return items;
  }, [products]);

  const showNoDeployment =
    machineQuery.isSuccess &&
    configQuery.isError &&
    isNoOpenDeploymentError(configQuery.error);

  const showOtherSlotError =
    machineQuery.isSuccess &&
    configQuery.isError &&
    !showNoDeployment;

  const showConfig =
    machineQuery.isSuccess &&
    configQuery.isSuccess &&
    slotsDraft &&
    !configQuery.isFetching;

  if (machineQuery.isPending) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading machine…</p>
      </div>
    );
  }

  if (machineQuery.isError) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Empty className="rounded-none border">
          <EmptyHeader>
            <EmptyTitle>Machine unavailable</EmptyTitle>
            <EmptyDescription>
              {errMessage(machineQuery.error)}. It may not belong to this
              organization.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const m = machineQuery.data;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium tracking-tight">
              {m.orgDisplayName}
            </h1>
            {m.disabled ? (
              <p className="mt-1 text-sm text-muted-foreground">Disabled</p>
            ) : null}
          </div>
          <Link
            to="/$orgSlug/contracts"
            params={{ orgSlug }}
            search={{ machineId }}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Contracts for this machine
          </Link>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium">Name in your organization</h2>
        <Card className="rounded-none border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Operator machine name</CardTitle>
            <CardDescription>
              Shared by everyone in this organization. Duplicates are allowed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-[12rem] flex-1 gap-1.5">
              <Label htmlFor="org-machine-name">Name</Label>
              <Input
                id="org-machine-name"
                className="rounded-none"
                value={orgDisplayNameDraft}
                onChange={(e) => setOrgDisplayNameDraft(e.target.value)}
                maxLength={200}
              />
            </div>
            <Button
              type="button"
              className="rounded-none"
              disabled={
                setOrgDisplayNameMutation.isPending ||
                !orgDisplayNameDraft.trim() ||
                orgDisplayNameDraft.trim() === m.orgDisplayName
              }
              onClick={() => {
                setOrgDisplayNameMutation.mutate({
                  orgSlug,
                  machineId,
                  orgDisplayName: orgDisplayNameDraft.trim(),
                });
              }}
            >
              {setOrgDisplayNameMutation.isPending ? "Saving…" : "Save name"}
            </Button>
          </CardContent>
        </Card>
      </section>

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
            <AnalyticsRangePicker
              value={analyticsWindow}
              onChange={setAnalyticsWindow}
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
          Latest 100 rows by default. Date filters apply to the table only;
          charts use the calendar period above (this machine only; no
          business-entity filter).
        </p>
        <PurchasesTable
          data={purchaseRows}
          isLoading={purchasesQuery.isPending}
          filters={purchaseFilters}
          onFiltersChange={setPurchaseFilters}
          onExportCsv={handleExportPurchases}
          showMachineColumn={false}
          showEntityColumn={false}
        />
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Contract</h2>
          <Link
            to="/$orgSlug/contracts"
            params={{ orgSlug }}
            search={{ machineId }}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            Open in Contracts →
          </Link>
        </div>
        {contractQuery.isPending ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !contract ? (
          <p className="text-xs text-muted-foreground">
            No contract on file for this machine in your organization.
          </p>
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

      <section>
        <h2 className="mb-3 text-sm font-medium">Slot configuration</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Assign your organization&apos;s products to the left, middle, and right
          dispenser slots. Saving requires an{" "}
          <span className="font-medium text-foreground">open deployment</span>{" "}
          for this machine.
        </p>

        {configQuery.isFetching && machineQuery.isSuccess ? (
          <p className="text-sm text-muted-foreground">Loading slot config…</p>
        ) : null}

        {showOtherSlotError ? (
          <Card className="mb-6 rounded-none border border-destructive/50">
            <CardHeader>
              <CardTitle className="text-base text-destructive">
                Could not load slot configuration
              </CardTitle>
              <CardDescription>
                {errMessage(configQuery.error)}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {showNoDeployment ? (
          <Empty className="rounded-none border">
            <EmptyHeader>
              <EmptyTitle>No open deployment</EmptyTitle>
              <EmptyDescription>
                This machine has no active deployment linked to a business entity
                in your organization. Ask an admin to start a deployment before
                you can configure slots.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {showConfig ? (
          <Card className="rounded-none border">
            <CardHeader>
              <CardTitle className="text-base">Dispenser slots</CardTitle>
              <CardDescription>
                Deployment{" "}
                <span className="font-mono text-xs">
                  {configQuery.data.deploymentId.slice(0, 8)}…
                </span>
                — choose a product per slot or leave empty.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {(
                [
                  ["left", "Left"],
                  ["middle", "Middle"],
                  ["right", "Right"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="grid gap-1.5">
                  <Label>{label}</Label>
                  <Select
                    items={productSlotSelectItems}
                    value={slotsDraft[key] ?? SLOT_EMPTY}
                    onValueChange={(v) => {
                      setSlotsDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              [key]: v === SLOT_EMPTY ? null : v,
                            }
                          : prev,
                      );
                    }}
                  >
                    <SelectTrigger className="h-9 w-full rounded-none text-sm">
                      <SelectValue placeholder="— Empty —" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="rounded-none">
                      <SelectItem value={SLOT_EMPTY}>— Empty —</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <Button
                type="button"
                className="w-fit rounded-none"
                onClick={handleSave}
                disabled={setSlotsMutation.isPending || products.length === 0}
              >
                {setSlotsMutation.isPending ? "Saving…" : "Save slots"}
              </Button>
              {products.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add products under Products before assigning slots.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
