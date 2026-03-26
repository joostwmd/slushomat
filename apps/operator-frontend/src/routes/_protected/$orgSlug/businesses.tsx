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
import { BusinessEntityListRow } from "@slushomat/ui/composite/business-entity-list-row";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/$orgSlug/businesses")({
  component: OperatorBusinessesPage,
});

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

type EntityRow = {
  id: string;
  operatorId: string;
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

function OperatorBusinessesPage() {
  const { orgSlug } = Route.useParams();
  const queryClient = useQueryClient();

  const listQuery = useQuery(
    trpc.operator.businessEntity.list.queryOptions({ orgSlug }),
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<BusinessEntityFormValues>(emptyForm);

  const invalidate = () => {
    void queryClient.invalidateQueries(
      trpc.operator.businessEntity.list.queryFilter({ orgSlug }),
    );
  };

  const createMutation = useMutation({
    ...trpc.operator.businessEntity.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Business created");
      invalidate();
      setSheetOpen(false);
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const updateMutation = useMutation({
    ...trpc.operator.businessEntity.update.mutationOptions(),
    onSuccess: () => {
      toast.success("Updated");
      invalidate();
      setSheetOpen(false);
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const archiveMutation = useMutation({
    ...trpc.operator.businessEntity.softDelete.mutationOptions(),
    onSuccess: () => {
      toast.success("Archived");
      invalidate();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const openCreate = () => {
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

  const handleSubmit = () => {
    if (!form.name.trim() || !form.legalName.trim()) {
      toast.error("Name and legal name required");
      return;
    }
    if (editId) {
      updateMutation.mutate({ orgSlug, id: editId, ...form });
    } else {
      createMutation.mutate({ orgSlug, ...form });
    }
  };

  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    archiveMutation.isPending;

  const rows = (listQuery.data ?? []) as EntityRow[];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Businesses</h1>
          <p className="text-sm text-muted-foreground">
            Legal entities for your organization.
          </p>
        </div>
        <Button type="button" className="rounded-none" onClick={openCreate}>
          New business
        </Button>
      </div>

      <Card className="rounded-none border">
        <CardHeader>
          <CardTitle className="text-base">Your entities</CardTitle>
          <CardDescription>
            {listQuery.isLoading ? "Loading…" : `${rows.length} listed`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !listQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : null}
          {rows.map((row) => (
            <BusinessEntityListRow
              key={row.id}
              name={row.name}
              legalName={row.legalName}
              city={row.city}
              country={row.country}
              vatId={row.vatId}
              onEdit={() => openEdit(row)}
              onArchive={() => {
                const ok = window.confirm(`Archive “${row.name}”?`);
                if (!ok) return;
                archiveMutation.mutate({ orgSlug, id: row.id });
              }}
              disabled={busy}
            />
          ))}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex w-full max-w-lg flex-col rounded-none sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editId ? "Edit" : "New business"}</SheetTitle>
            <SheetDescription>Legal &amp; address details.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <BusinessEntityForm
              value={form}
              onChange={setForm}
              disabled={busy}
              idPrefix="op-be"
            />
          </div>
          <SheetFooter className="border-t">
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => setSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button
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
