import { buttonVariants } from "@slushomat/ui/base/button";
import { exportPurchasesToZip } from "@slushomat/ui/composite/purchases-export";
import { PurchasesTable } from "@slushomat/ui/composite/purchases-table";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { cn } from "@slushomat/ui/lib/utils";

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
    businessEntityId?: string;
  }>({});

  const entitiesQuery = useQuery(
    trpc.operator.businessEntity.list.queryOptions({ orgSlug }),
  );
  const purchasesQuery = useQuery({
    ...trpc.operator.purchase.list.queryOptions({
      orgSlug,
      machineId,
      startDate: filters.dateFrom,
      endDate: filters.dateTo,
      businessEntityId: filters.businessEntityId,
      limit: 100,
    }),
  });

  const entityOptions = useMemo(
    () =>
      (entitiesQuery.data ?? []).map((e) => ({
        id: e.id,
        label: e.name,
      })),
    [entitiesQuery.data],
  );

  const rows = useMemo(() => {
    const data = purchasesQuery.data ?? [];
    return data.map((r) => ({
      id: r.id,
      purchasedAt: r.purchasedAt,
      machineId: r.machineId,
      slot: r.slot,
      productName: r.productName,
      amountInCents: r.amountInCents,
      businessEntityName: r.businessEntityName,
    }));
  }, [purchasesQuery.data]);

  const handleExport = async () => {
    await exportPurchasesToZip(rows, `${orgSlug}-${machineId.slice(0, 8)}`);
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Link
        to="/$orgSlug/machines/$machineId"
        params={{ orgSlug, machineId }}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 mb-4 inline-flex px-2 text-muted-foreground",
        )}
      >
        ← Machine
      </Link>
      <h1 className="mb-2 font-mono text-lg font-medium">Purchases</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Sales for machine <span className="font-mono">{machineId}</span>.
      </p>

      <PurchasesTable
        data={rows}
        isLoading={purchasesQuery.isPending}
        filters={filters}
        onFiltersChange={setFilters}
        onExportCsv={handleExport}
        showMachineColumn={false}
        showEntityColumn
        entityOptions={entityOptions}
      />
    </div>
  );
}
