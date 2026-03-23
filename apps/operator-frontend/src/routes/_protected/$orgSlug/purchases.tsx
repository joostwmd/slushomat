import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import { exportPurchasesToZip } from "@slushomat/ui/composite/purchases-export";
import { PurchasesTable } from "@slushomat/ui/composite/purchases-table";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CpuIcon } from "lucide-react";
import { buttonVariants } from "@slushomat/ui/base/button";
import { cn } from "@slushomat/ui/lib/utils";

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

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-xl font-medium">Purchases</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Filter sales recorded from your machines. Export the current table as a
        ZIP with CSV.
      </p>

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
              <li key={m.id}>
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
                        Purchases, contract, and slot configuration
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "px-0 text-xs",
                        )}
                      >
                        Open →
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
