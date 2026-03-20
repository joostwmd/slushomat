import { Button } from "@slushomat/ui/base/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import { Label } from "@slushomat/ui/base/label";
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
import { BusinessEntityListRow } from "@slushomat/ui/composite/business-entity-list-row";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_admin/businesses")({
  component: AdminBusinessesPage,
});

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

type EntityRow = {
  id: string;
  organizationId: string;
  name: string;
  legalName: string;
  legalForm: string;
  vatId: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

const emptyForm = (): BusinessEntityFormValues => ({
  name: "",
  legalName: "",
  legalForm: "",
  vatId: "",
  street: "",
  city: "",
  postalCode: "",
  country: "DE",
});

function AdminBusinessesPage() {
  const queryClient = useQueryClient();
  const orgsQuery = useQuery(trpc.admin.listOrganizations.queryOptions());

  const [organizationId, setOrganizationId] = useState<string>("");
  const orgOptions = useMemo(
    () => orgsQuery.data ?? [],
    [orgsQuery.data],
  );

  const listQuery = useQuery({
    ...trpc.admin.businessEntity.listByOrganization.queryOptions({
      organizationId,
    }),
    enabled: !!organizationId,
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<BusinessEntityFormValues>(emptyForm);

  const invalidate = () => {
    if (!organizationId) return;
    void queryClient.invalidateQueries(
      trpc.admin.businessEntity.listByOrganization.queryFilter({
        organizationId,
      }),
    );
  };

  const createMutation = useMutation({
    ...trpc.admin.businessEntity.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Business created");
      invalidate();
      setSheetOpen(false);
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const updateMutation = useMutation({
    ...trpc.admin.businessEntity.update.mutationOptions(),
    onSuccess: () => {
      toast.success("Business updated");
      invalidate();
      setSheetOpen(false);
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const archiveMutation = useMutation({
    ...trpc.admin.businessEntity.softDelete.mutationOptions(),
    onSuccess: () => {
      toast.success("Archived");
      invalidate();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const openCreate = () => {
    if (!organizationId) {
      toast.error("Select an organization first");
      return;
    }
    setEditId(null);
    setForm(emptyForm());
    setSheetOpen(true);
  };

  const openEdit = (row: EntityRow) => {
    setEditId(row.id);
    setForm({
      name: row.name,
      legalName: row.legalName,
      legalForm: row.legalForm,
      vatId: row.vatId,
      street: row.street,
      city: row.city,
      postalCode: row.postalCode,
      country: row.country || "DE",
    });
    setSheetOpen(true);
  };

  const handleArchive = (row: EntityRow) => {
    if (!organizationId) return;
    const ok = window.confirm(`Archive “${row.name}”?`);
    if (!ok) return;
    archiveMutation.mutate({ id: row.id, organizationId });
  };

  const handleSubmit = () => {
    if (!organizationId) return;
    if (!form.name.trim() || !form.legalName.trim()) {
      toast.error("Name and legal name are required");
      return;
    }
    if (editId) {
      updateMutation.mutate({
        id: editId,
        organizationId,
        ...form,
      });
    } else {
      createMutation.mutate({
        organizationId,
        ...form,
      });
    }
  };

  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    archiveMutation.isPending;

  const visibleRows =
    listQuery.data?.filter((r) => !r.deletedAt) ?? [];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-xl font-medium">Businesses</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Legal entities per customer organization. Select an org, then create
        or edit records used for contracts and deployments.
      </p>

      <Card className="mb-6 rounded-none border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Organization</CardTitle>
          <CardDescription>
            Which customer&apos;s business entities to manage.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-[220px] flex-1 gap-1.5">
            <Label htmlFor="org-pick">Organization</Label>
            <select
              id="org-pick"
              className="h-8 w-full rounded-none border border-input bg-transparent px-2 text-xs dark:bg-input/30"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              <option value="">— Select —</option>
              {orgOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.slug})
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            className="rounded-none"
            onClick={openCreate}
            disabled={!organizationId}
          >
            New business
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-none border">
        <CardHeader>
          <CardTitle className="text-base">Entities</CardTitle>
          <CardDescription>
            {!organizationId
              ? "Pick an organization to load its businesses."
              : listQuery.isLoading
                ? "Loading…"
                : `${visibleRows.length} active`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organizationId && visibleRows.length === 0 && !listQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">No businesses yet.</p>
          ) : null}
          {visibleRows.map((row) => (
            <BusinessEntityListRow
              key={row.id}
              name={row.name}
              legalName={row.legalName}
              city={row.city}
              country={row.country}
              vatId={row.vatId}
              onEdit={() => openEdit(row)}
              onArchive={() => handleArchive(row)}
              disabled={busy}
            />
          ))}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex w-full max-w-lg flex-col rounded-none sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editId ? "Edit business" : "New business"}
            </SheetTitle>
            <SheetDescription>
              Address and legal details for this entity.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <BusinessEntityForm
              value={form}
              onChange={setForm}
              disabled={busy}
              idPrefix="admin-be"
            />
          </div>
          <SheetFooter className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => setSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-none"
              onClick={handleSubmit}
              disabled={busy}
            >
              {editId ? "Save" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
