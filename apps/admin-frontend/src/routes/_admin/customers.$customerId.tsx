import { Button, buttonVariants } from "@slushomat/ui/base/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import { ProductListRow } from "@slushomat/ui/composite/product-list-row";
import { PurchasesTable } from "@slushomat/ui/composite/purchases-table";
import { BusinessEntityListRow } from "@slushomat/ui/composite/business-entity-list-row";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { cn } from "@slushomat/ui/lib/utils";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_admin/customers/$customerId")({
  component: CustomerDetailPage,
});

type TabId = "overview" | "machines" | "products" | "purchases";

function formatEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function CustomerDetailPage() {
  const { customerId } = Route.useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("overview");
  const [purchaseFilters, setPurchaseFilters] = useState<{
    dateFrom?: Date;
    dateTo?: Date;
    businessEntityId?: string;
    machineId?: string;
  }>({});

  const orgQuery = useQuery(
    trpc.admin.customer.get.queryOptions({ organizationId: customerId }),
  );
  const entitiesQuery = useQuery(
    trpc.admin.businessEntity.listByOrganization.queryOptions({
      organizationId: customerId,
    }),
  );
  const machinesQuery = useQuery(
    trpc.admin.customer.listMachines.queryOptions({
      organizationId: customerId,
    }),
  );
  const productsQuery = useQuery(
    trpc.admin.operatorProduct.listByOrganization.queryOptions({
      organizationId: customerId,
    }),
  );
  const purchasesQuery = useQuery({
    ...trpc.admin.purchase.list.queryOptions({
      organizationId: customerId,
      startDate: purchaseFilters.dateFrom,
      endDate: purchaseFilters.dateTo,
      businessEntityId: purchaseFilters.businessEntityId,
      machineId: purchaseFilters.machineId,
      limit: 100,
    }),
    enabled: tab === "purchases",
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
        id: m.machineId,
        label: `${m.machineId.slice(0, 8)}…`,
      })),
    [machinesQuery.data],
  );

  const purchaseRows = useMemo(() => {
    const rows = purchasesQuery.data ?? [];
    return rows.map((r) => ({
      id: r.id,
      purchasedAt: r.purchasedAt,
      machineId: r.machineId,
      slot: r.slot,
      productName: r.productName,
      amountInCents: r.amountInCents,
      businessEntityName: r.businessEntityName,
    }));
  }, [purchasesQuery.data]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "machines", label: "Machines" },
    { id: "products", label: "Products" },
    { id: "purchases", label: "Purchases" },
  ];

  if (orgQuery.isError) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-destructive">Organization not found.</p>
        <Button
          className="mt-4"
          variant="outline"
          size="sm"
          render={<Link to="/customers" />}
        >
          ← Customers
        </Button>
      </div>
    );
  }

  const org = orgQuery.data;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          render={<Link to="/customers" />}
        >
          ← Customers
        </Button>
        {orgQuery.isPending ? (
          <span className="text-sm text-muted-foreground">Loading…</span>
        ) : org ? (
          <>
            <h1 className="text-xl font-medium">{org.name}</h1>
            <span className="rounded-none border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {org.slug}
            </span>
          </>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              tab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium">Business entities</h2>
            <Link
              to="/businesses"
              search={{ organizationId: customerId }}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Add entity
            </Link>
          </div>
          {entitiesQuery.isPending ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (entitiesQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No business entities yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {(entitiesQuery.data ?? []).map((e) => (
                <li key={e.id}>
                  <BusinessEntityListRow
                    name={e.name}
                    legalName={e.legalName}
                    city={e.city}
                    country={e.country}
                    vatId={e.vatId}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "machines" ? (
        <div>
          {machinesQuery.isPending ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (machinesQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No machines yet.</p>
          ) : (
            <MachinesTable className="text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="p-2 text-left font-medium text-muted-foreground">
                    Machine
                  </th>
                  <th className="p-2 text-left font-medium text-muted-foreground">
                    Version
                  </th>
                  <th className="p-2 text-left font-medium text-muted-foreground">
                    Contract
                  </th>
                  <th className="p-2 text-left font-medium text-muted-foreground">
                    Deployed
                  </th>
                </tr>
              </thead>
              <tbody>
                {(machinesQuery.data ?? []).map((m) => (
                  <tr
                    key={m.machineId}
                    className="cursor-pointer border-b border-border hover:bg-muted/20"
                    onClick={() =>
                      navigate({
                        to: "/customers/$customerId/machines/$machineId",
                        params: {
                          customerId,
                          machineId: m.machineId,
                        },
                      })
                    }
                  >
                    <td className="p-2 font-mono text-[10px]">{m.machineId}</td>
                    <td className="p-2">{m.versionNumber}</td>
                    <td className="p-2">
                      <StatusBadge status={m.contractStatus} />
                    </td>
                    <td className="p-2">
                      {m.hasOpenDeployment ? "Yes" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </MachinesTable>
          )}
        </div>
      ) : null}

      {tab === "products" ? (
        <div className="space-y-3">
          {productsQuery.isPending ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (productsQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No operator products for this organization.
            </p>
          ) : (
            <Card className="rounded-none border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Products</CardTitle>
                <CardDescription className="text-xs">
                  Read-only list of operator products.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border pt-0">
                {(productsQuery.data ?? []).map((p) => (
                  <ProductListRow
                    key={p.id}
                    name={p.name}
                    priceLabel={formatEur(p.priceInCents)}
                    taxRatePercent={
                      p.taxRatePercent === 7 || p.taxRatePercent === 19
                        ? p.taxRatePercent
                        : 19
                    }
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {tab === "purchases" ? (
        <PurchasesTable
          data={purchaseRows}
          isLoading={purchasesQuery.isPending}
          filters={purchaseFilters}
          onFiltersChange={setPurchaseFilters}
          showMachineColumn
          showEntityColumn
          entityOptions={entityOptions}
          machineOptions={machineOptions}
        />
      ) : null}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "draft" | "active" | "terminated" | "none";
}) {
  const label =
    status === "none"
      ? "None"
      : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className="inline-block rounded-none border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
      {label}
    </span>
  );
}

function MachinesTable({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto border border-border">
      <table className={cn("w-full", className)}>{children}</table>
    </div>
  );
}
