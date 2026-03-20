import { Button } from "@slushomat/ui/base/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@slushomat/ui/base/sheet";
import {
  BusinessEntityForm,
  type BusinessEntityFormValues,
} from "@slushomat/ui/composite/business-entity-form";
import { ProductListRow } from "@slushomat/ui/composite/product-list-row";
import { PurchasesTable } from "@slushomat/ui/composite/purchases-table";
import { BusinessEntityListRow } from "@slushomat/ui/composite/business-entity-list-row";
import { env } from "@slushomat/env/web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@slushomat/ui/lib/utils";

import { trpc } from "@/utils/trpc";

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

const emptyEntityForm = (): BusinessEntityFormValues => ({
  name: "",
  legalName: "",
  legalForm: "",
  vatId: "",
  street: "",
  city: "",
  postalCode: "",
  country: "DE",
});

export const Route = createFileRoute("/_admin/customers/$customerId/")({
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
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>("overview");
  const [entitySheetOpen, setEntitySheetOpen] = useState(false);
  const [entityForm, setEntityForm] = useState<BusinessEntityFormValues>(
    emptyEntityForm,
  );
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

  const ownerQuery = useQuery({
    ...trpc.admin.customer.getOrganizationOwner.queryOptions({
      organizationId: customerId,
    }),
    enabled: orgQuery.isSuccess,
  });

  const [impersonateOwnerBusy, setImpersonateOwnerBusy] = useState(false);

  const operatorHandoffMutation = useMutation({
    ...trpc.admin.createOperatorHandoffToken.mutationOptions(),
    onError: (e) => toast.error(errMessage(e)),
  });

  const disableAllMachinesMutation = useMutation({
    ...trpc.admin.customer.disableAllMachines.mutationOptions(),
    onSuccess: (data) => {
      toast.success(
        data.count === 0
          ? "No machines linked to this organization via contracts."
          : `Disabled ${data.count} machine(s).`,
      );
      void queryClient.invalidateQueries(
        trpc.admin.customer.listMachines.queryFilter({
          organizationId: customerId,
        }),
      );
      void queryClient.invalidateQueries(trpc.admin.machine.list.queryFilter());
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const createEntityMutation = useMutation({
    ...trpc.admin.businessEntity.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Business entity created");
      void queryClient.invalidateQueries(
        trpc.admin.businessEntity.listByOrganization.queryFilter({
          organizationId: customerId,
        }),
      );
      setEntitySheetOpen(false);
      setEntityForm(emptyEntityForm());
    },
    onError: (e) => toast.error(errMessage(e)),
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

  const handleImpersonateOwner = async () => {
    const owner = ownerQuery.data;
    if (!owner) return;
    setImpersonateOwnerBusy(true);
    try {
      const { token } = await operatorHandoffMutation.mutateAsync({
        userId: owner.userId,
      });
      const operatorUrl =
        env.VITE_OPERATOR_URL ??
        window.location.origin.replace("admin", "operator");
      window.open(
        `${operatorUrl}/auth/handoff?token=${encodeURIComponent(token)}`,
        "_blank",
      );
      toast.success("Opening operator dashboard in a new tab…");
    } catch {
      /* mutation onError toasts */
    } finally {
      setImpersonateOwnerBusy(false);
    }
  };

  const handleDisableAllMachines = () => {
    const n = machinesQuery.data?.length ?? 0;
    const message =
      n === 0
        ? "This organization has no machines linked by contract. Nothing will change. Continue?"
        : `Disable all ${n} machine(s) linked to this organization? Devices will stop authenticating until re-enabled.`;
    if (!window.confirm(message)) return;
    disableAllMachinesMutation.mutate({ organizationId: customerId });
  };

  if (orgQuery.isError) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-destructive">Organization not found.</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Use the breadcrumb trail or{" "}
          <Link to="/customers" className="text-primary underline-offset-4 hover:underline">
            customers list
          </Link>{" "}
          to continue.
        </p>
      </div>
    );
  }

  const org = orgQuery.data;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
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
        {org ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none text-xs"
              disabled={
                impersonateOwnerBusy ||
                operatorHandoffMutation.isPending ||
                ownerQuery.isPending ||
                ownerQuery.isError ||
                !ownerQuery.data
              }
              title={
                ownerQuery.data
                  ? `Open operator as ${ownerQuery.data.email}`
                  : "No member with role “owner” for this organization."
              }
              onClick={() => void handleImpersonateOwner()}
            >
              {impersonateOwnerBusy ? (
                <>
                  <Loader2Icon
                    className="size-3.5 animate-spin"
                    aria-hidden
                  />
                  <span className="ml-1.5">Opening…</span>
                </>
              ) : ownerQuery.isPending ? (
                <>
                  <Loader2Icon
                    className="size-3.5 animate-spin"
                    aria-hidden
                  />
                  <span className="ml-1.5">Loading…</span>
                </>
              ) : (
                "Impersonate owner"
              )}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="rounded-none text-xs"
              disabled={disableAllMachinesMutation.isPending}
              onClick={handleDisableAllMachines}
            >
              {disableAllMachinesMutation.isPending ? (
                <>
                  <Loader2Icon
                    className="size-3.5 animate-spin"
                    aria-hidden
                  />
                  <span className="ml-1.5">Disabling…</span>
                </>
              ) : (
                "Disable all machines"
              )}
            </Button>
          </div>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEntityForm(emptyEntityForm());
                setEntitySheetOpen(true);
              }}
            >
              Add entity
            </Button>
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

      <Sheet open={entitySheetOpen} onOpenChange={setEntitySheetOpen}>
        <SheetContent className="flex max-h-[100dvh] flex-col gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add business entity</SheetTitle>
            <SheetDescription>
              Legal entity for this customer — used on contracts and
              deployments.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <BusinessEntityForm
              idPrefix="customer-entity"
              value={entityForm}
              onChange={setEntityForm}
              disabled={createEntityMutation.isPending}
            />
          </div>
          <SheetFooter className="border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEntitySheetOpen(false)}
              disabled={createEntityMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={createEntityMutation.isPending}
              onClick={() => {
                if (!entityForm.name.trim() || !entityForm.legalName.trim()) {
                  toast.error("Name and legal name are required");
                  return;
                }
                createEntityMutation.mutate({
                  organizationId: customerId,
                  ...entityForm,
                });
              }}
            >
              Create
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
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
