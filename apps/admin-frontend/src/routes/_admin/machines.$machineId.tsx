import { buttonVariants } from "@slushomat/ui/base/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import { PurchasesTable } from "@slushomat/ui/composite/purchases-table";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { cn } from "@slushomat/ui/lib/utils";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_admin/machines/$machineId")({
  component: AdminGlobalMachineDetailPage,
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

function AdminGlobalMachineDetailPage() {
  const { machineId } = Route.useParams();
  const [purchaseFilters, setPurchaseFilters] = useState<{
    dateFrom?: Date;
    dateTo?: Date;
    businessEntityId?: string;
  }>({});

  const machineQuery = useQuery(
    trpc.admin.machine.get.queryOptions({ id: machineId }),
  );

  const contractQuery = useQuery(
    trpc.admin.operatorContract.list.queryOptions({
      machineId,
    }),
  );

  const contract = (contractQuery.data ?? [])[0];
  const organizationId = contract?.organizationId;

  const orgQuery = useQuery({
    ...trpc.admin.customer.get.queryOptions({
      organizationId: organizationId ?? "",
    }),
    enabled: !!organizationId,
  });

  const machineMetaQuery = useQuery({
    ...trpc.admin.customer.listMachines.queryOptions({
      organizationId: organizationId ?? "",
    }),
    enabled: !!organizationId,
  });

  const machineOrgMeta = (machineMetaQuery.data ?? []).find(
    (x) => x.machineId === machineId,
  );

  const slotQuery = useQuery({
    ...trpc.admin.machineSlot.getConfigForMachine.queryOptions({
      organizationId: organizationId ?? "",
      machineId,
    }),
    enabled: !!organizationId,
  });

  const entitiesQuery = useQuery({
    ...trpc.admin.businessEntity.listByOrganization.queryOptions({
      organizationId: organizationId ?? "",
    }),
    enabled: !!organizationId,
  });

  const purchasesQuery = useQuery({
    ...trpc.admin.purchase.list.queryOptions({
      machineId,
      startDate: purchaseFilters.dateFrom,
      endDate: purchaseFilters.dateTo,
      businessEntityId: purchaseFilters.businessEntityId,
      limit: 100,
    }),
    enabled: machineQuery.isSuccess,
  });

  const entityName = useMemo(() => {
    if (!contract) return null;
    const e = (entitiesQuery.data ?? []).find(
      (x) => x.id === contract.businessEntityId,
    );
    return e?.name ?? null;
  }, [contract, entitiesQuery.data]);

  const entityOptions = useMemo(
    () =>
      (entitiesQuery.data ?? []).map((e) => ({
        id: e.id,
        label: e.name,
      })),
    [entitiesQuery.data],
  );

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
        <p className="text-sm text-destructive">
          {machineQuery.error.message ?? "Machine not found."}
        </p>
      </div>
    );
  }

  const m = machineQuery.data;
  const org = orgQuery.data;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {organizationId
              ? (org?.name ?? "Organization")
              : "No operator contract"}
          </p>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-medium">
                {machineOrgMeta?.orgDisplayName ??
                  (m.internalName.trim() || "Unnamed machine")}
              </h1>
              <span className="rounded-none border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                v{m.versionNumber}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Internal:{" "}
              <span className="text-foreground">
                {m.internalName.trim() || "—"}
              </span>
              {machineOrgMeta ? (
                <>
                  {" "}
                  · Operator org name:{" "}
                  <span className="text-foreground">
                    {machineOrgMeta.orgDisplayName}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        {organizationId ? (
          <Link
            to="/contracts"
            search={{ organizationId, machineId }}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Configure contract
          </Link>
        ) : null}
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium">Purchases</h2>
        <PurchasesTable
          data={purchaseRows}
          isLoading={purchasesQuery.isPending}
          filters={purchaseFilters}
          onFiltersChange={setPurchaseFilters}
          showMachineColumn={false}
          showEntityColumn
          entityOptions={entityOptions}
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium">Slot configuration</h2>
        {!organizationId ? (
          <p className="text-xs text-muted-foreground">
            Slot layout is tied to an operator deployment. Add an operator
            contract for this machine to view or edit slots from the customer
            context, or open the customer that owns this deployment.
          </p>
        ) : slotQuery.isPending ? (
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
          {organizationId ? (
            <Link
              to="/contracts"
              search={{ organizationId, machineId }}
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              View all contracts →
            </Link>
          ) : null}
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
