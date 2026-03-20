import { Button } from "@slushomat/ui/base/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slushomat/ui/base/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@slushomat/ui/base/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@slushomat/ui/base/sheet";
import { ProductListRow } from "@slushomat/ui/composite/product-list-row";
import {
  ProductForm,
  type ProductFormValues,
} from "@slushomat/ui/composite/product-form";
import { createSupabaseBrowserClient } from "@slushomat/supabase";
import { env } from "@slushomat/env/web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PackageIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  DeleteOperatorProductDialog,
  OperatorProductUploadFailureDialog,
  ReplaceOperatorProductImageDialog,
} from "@/components/operator-product-dialogs";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/$orgSlug/products")({
  component: OperatorProductsPage,
});

type ListRow = {
  id: string;
  name: string;
  priceInCents: number;
  taxRatePercent: 7 | 19;
  createdAt: Date;
  updatedAt: Date;
  imageUrl: string | null;
};

function errMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return "Something went wrong";
}

function eurosToCents(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(",", ".").trim());
  if (Number.isNaN(n) || n < 0) {
    return null;
  }
  return Math.round(n * 100);
}

function centsToEurosLabel(cents: number): string {
  return (cents / 100).toFixed(2);
}

function OperatorProductsPage() {
  const { orgSlug } = Route.useParams();
  const queryClient = useQueryClient();

  const listQuery = useQuery(
    trpc.operator.product.list.queryOptions({ orgSlug }),
  );

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const templatesQuery = useQuery({
    ...trpc.operator.product.listTemplates.queryOptions({ orgSlug }),
    enabled: templateDialogOpen,
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormValues>({
    name: "",
    priceEuros: "",
    taxRatePercent: 19,
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(
    null,
  );
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ListRow | null>(null);
  const [uploadFailure, setUploadFailure] = useState<{
    operatorProductId: string;
    label: string;
    file: File;
    message: string;
  } | null>(null);

  const invalidateList = () => {
    void queryClient.invalidateQueries(
      trpc.operator.product.list.queryFilter({ orgSlug }),
    );
  };

  const createMutation = useMutation({
    ...trpc.operator.product.create.mutationOptions(),
    onSuccess: () => {
      invalidateList();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const updateMutation = useMutation({
    ...trpc.operator.product.update.mutationOptions(),
    onSuccess: () => {
      invalidateList();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const deleteMutation = useMutation({
    ...trpc.operator.product.delete.mutationOptions(),
    onSuccess: () => {
      toast.success("Product removed");
      invalidateList();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const copyFromTemplateMutation = useMutation({
    ...trpc.operator.product.copyFromTemplate.mutationOptions(),
    onSuccess: () => {
      toast.success("Product added from template");
      invalidateList();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const requestUploadMutation = useMutation(
    trpc.operator.product.requestImageUpload.mutationOptions(),
  );

  const confirmImageMutation = useMutation(
    trpc.operator.product.confirmProductImage.mutationOptions(),
  );

  const resetForm = () => {
    setEditId(null);
    setForm({
      name: "",
      priceEuros: "",
      taxRatePercent: 19,
    });
    setPendingFile(null);
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl(null);
    }
    setStagedFile(null);
  };

  const openCreate = () => {
    resetForm();
    setSheetOpen(true);
  };

  const openEdit = (row: ListRow) => {
    resetForm();
    setEditId(row.id);
    setForm({
      name: row.name,
      priceEuros: centsToEurosLabel(row.priceInCents),
      taxRatePercent: row.taxRatePercent,
    });
    setSheetOpen(true);
  };

  const openTemplateDialog = () => {
    setTemplateDialogOpen(true);
  };

  const applySelectedFile = (file: File) => {
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
  };

  const handlePickFile = (file: File) => {
    const row = listQuery.data?.find((r) => r.id === editId);
    if (editId && (row?.imageUrl || pendingFile)) {
      setStagedFile(file);
      setReplaceDialogOpen(true);
      return;
    }
    applySelectedFile(file);
  };

  const handleClearImage = () => {
    setPendingFile(null);
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl(null);
    }
  };

  const uploadImage = async (operatorProductId: string, file: File) => {
    const mime =
      file.type?.toLowerCase().split(";")[0]?.trim() === "image/jpeg" ||
      file.name.toLowerCase().endsWith(".jpg") ||
      file.name.toLowerCase().endsWith(".jpeg")
        ? ("image/jpeg" as const)
        : file.type?.toLowerCase().split(";")[0]?.trim() === "image/png" ||
            file.name.toLowerCase().endsWith(".png")
          ? ("image/png" as const)
          : null;
    if (!mime) {
      throw new Error("Only JPEG and PNG images are allowed.");
    }
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const anon = env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anon) {
      throw new Error(
        "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for image upload.",
      );
    }
    const signed = await requestUploadMutation.mutateAsync({
      orgSlug,
      operatorProductId,
      contentType: mime,
      filename: file.name,
      fileSizeBytes: file.size,
    });
    const client = createSupabaseBrowserClient(supabaseUrl, anon);
    const { error } = await client.storage
      .from(signed.bucket)
      .uploadToSignedUrl(signed.path, signed.token, file, {
        contentType: mime,
      });
    if (error) {
      throw new Error(error.message);
    }
    await confirmImageMutation.mutateAsync({
      orgSlug,
      operatorProductId,
      objectPath: signed.path,
    });
  };

  const submitSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = form.name.trim();
    if (!trimmed) {
      toast.error("Name is required.");
      return;
    }
    const cents = eurosToCents(form.priceEuros);
    if (cents === null) {
      toast.error("Enter a valid price in euros.");
      return;
    }

    const fileToUpload = pendingFile;

    try {
      if (editId) {
        await updateMutation.mutateAsync({
          orgSlug,
          id: editId,
          name: trimmed,
          priceInCents: cents,
          taxRatePercent: form.taxRatePercent,
        });
        if (fileToUpload) {
          try {
            await uploadImage(editId, fileToUpload);
            toast.success("Product updated.");
          } catch (err) {
            setUploadFailure({
              operatorProductId: editId,
              label: trimmed,
              file: fileToUpload,
              message: errMessage(err),
            });
            return;
          }
        } else {
          toast.success("Product updated.");
        }
        setSheetOpen(false);
        resetForm();
        return;
      }

      const created = await createMutation.mutateAsync({
        orgSlug,
        name: trimmed,
        priceInCents: cents,
        taxRatePercent: form.taxRatePercent,
      });

      if (fileToUpload) {
        try {
          await uploadImage(created.id, fileToUpload);
          toast.success("Product created.");
        } catch (err) {
          setUploadFailure({
            operatorProductId: created.id,
            label: trimmed,
            file: fileToUpload,
            message: errMessage(err),
          });
          return;
        }
      } else {
        toast.success("Product created.");
      }
      setSheetOpen(false);
      resetForm();
    } catch {
      /* toast via mutation onError */
    }
  };

  const rows: ListRow[] = listQuery.data ?? [];
  const loading = listQuery.isPending;

  const imagePreviewUrl =
    pendingPreviewUrl ??
    (editId
      ? (listQuery.data?.find((r) => r.id === editId)?.imageUrl ?? null)
      : null);

  const isUploading =
    requestUploadMutation.isPending || confirmImageMutation.isPending;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Products</h1>
          <p className="text-sm text-muted-foreground">
            Organization catalog — name, price, VAT, optional image.
          </p>
        </div>
        {rows.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={openTemplateDialog}>
              Add from template
            </Button>
            <Button type="button" size="sm" onClick={openCreate}>
              Create product
            </Button>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catalog</CardTitle>
          <CardDescription className="text-xs">
            Products for this organization. Images: JPEG or PNG, max 5&nbsp;MB,
            via Supabase signed uploads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : listQuery.isError ? (
            <p className="text-sm text-destructive">
              Could not load products. {errMessage(listQuery.error)}
            </p>
          ) : rows.length === 0 ? (
            <Empty className="min-h-[220px] border-none bg-transparent">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageIcon />
                </EmptyMedia>
                <EmptyTitle>No products yet</EmptyTitle>
                <EmptyDescription>
                  Create a product from scratch or copy one from the global
                  template catalog.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row flex-wrap justify-center gap-2">
                <Button type="button" size="sm" onClick={openCreate}>
                  Create product
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={openTemplateDialog}
                >
                  Add from template
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="overflow-x-auto border border-border">
              <div className="divide-y divide-border px-3">
                {rows.map((row) => (
                  <ProductListRow
                    key={row.id}
                    name={row.name}
                    priceLabel={`€${centsToEurosLabel(row.priceInCents)}`}
                    taxRatePercent={row.taxRatePercent}
                    thumbnailUrl={row.imageUrl}
                    actions={
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => openEdit(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(row)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </>
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) {
            resetForm();
          }
        }}
      >
        <SheetContent className="flex flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editId ? "Edit product" : "New product"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Name, gross-style price in euros, German VAT rate, optional image
              (JPEG or PNG, max 5&nbsp;MB).
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
            onSubmit={submitSheet}
          >
            <ProductForm
              idPrefix={editId ? "op-product-edit" : "op-product-create"}
              value={form}
              onChange={setForm}
              onPickFile={handlePickFile}
              onClearImage={handleClearImage}
              disabled={createMutation.isPending || updateMutation.isPending}
              isUploading={isUploading}
              imagePreviewUrl={imagePreviewUrl}
              selectedFile={pendingFile}
            />
            <SheetFooter className="mt-auto flex-row gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSheetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  isUploading
                }
              >
                Save
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
      >
        <DialogContent className="flex max-h-[min(80vh,640px)] max-w-lg flex-col gap-0 p-0">
          <DialogHeader className="border-b border-border p-4 pb-3">
            <DialogTitle className="text-sm font-medium">
              Add from template
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pick a template to copy into your organization catalog (name,
              price, tax, and image when available).
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {(templatesQuery.isPending || templatesQuery.isFetching) &&
            (templatesQuery.data?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">Loading templates…</p>
            ) : templatesQuery.isError ? (
              <p className="text-xs text-destructive">
                {errMessage(templatesQuery.error)}
              </p>
            ) : (templatesQuery.data?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">
                No template products are available.
              </p>
            ) : (
              <div className="space-y-0 border border-border">
                {(templatesQuery.data ?? []).map((t) => (
                  <ProductListRow
                    key={t.id}
                    name={t.name}
                    priceLabel={`€${centsToEurosLabel(t.priceInCents)}`}
                    taxRatePercent={t.taxRatePercent}
                    thumbnailUrl={t.imageUrl}
                    actions={
                      <Button
                        type="button"
                        size="sm"
                        className="h-7"
                        disabled={copyFromTemplateMutation.isPending}
                        onClick={() => {
                          copyFromTemplateMutation.mutate(
                            { orgSlug, templateProductId: t.id },
                            {
                              onSuccess: () => setTemplateDialogOpen(false),
                            },
                          );
                        }}
                      >
                        Add
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="border-t border-border p-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTemplateDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteOperatorProductDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
          }
        }}
        name={deleteTarget?.name ?? ""}
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }
          deleteMutation.mutate(
            { orgSlug, id: deleteTarget.id },
            {
              onSuccess: () => setDeleteTarget(null),
            },
          );
        }}
      />

      <ReplaceOperatorProductImageDialog
        open={replaceDialogOpen}
        onOpenChange={(o) => {
          setReplaceDialogOpen(o);
          if (!o) {
            setStagedFile(null);
          }
        }}
        pending={false}
        onConfirm={() => {
          if (stagedFile) {
            applySelectedFile(stagedFile);
            setStagedFile(null);
          }
          setReplaceDialogOpen(false);
        }}
      />

      <OperatorProductUploadFailureDialog
        open={!!uploadFailure}
        onOpenChange={(o) => {
          if (!o) {
            setUploadFailure(null);
          }
        }}
        productLabel={uploadFailure?.label ?? ""}
        errorMessage={uploadFailure?.message ?? ""}
        pending={
          deleteMutation.isPending ||
          requestUploadMutation.isPending ||
          confirmImageMutation.isPending
        }
        onRetry={async () => {
          if (!uploadFailure) {
            return;
          }
          try {
            await uploadImage(
              uploadFailure.operatorProductId,
              uploadFailure.file,
            );
            toast.success("Image uploaded.");
            setUploadFailure(null);
            invalidateList();
            setSheetOpen(false);
            resetForm();
          } catch (err) {
            setUploadFailure((prev) =>
              prev ? { ...prev, message: errMessage(err) } : prev,
            );
          }
        }}
        onDeleteDraft={() => {
          if (!uploadFailure) {
            return;
          }
          deleteMutation.mutate(
            { orgSlug, id: uploadFailure.operatorProductId },
            {
              onSuccess: () => {
                setUploadFailure(null);
                setSheetOpen(false);
                resetForm();
                toast.success("Draft product removed.");
              },
            },
          );
        }}
        onKeepWithoutImage={() => {
          setUploadFailure(null);
          setSheetOpen(false);
          resetForm();
          toast.message("Kept product without image. You can edit it later.");
        }}
      />
    </div>
  );
}
