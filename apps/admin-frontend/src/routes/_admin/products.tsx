import { Button } from "@slushomat/ui/base/button";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@slushomat/ui/base/sheet";
import {
  PRODUCT_IMAGE_MAX_BYTES,
  ProductForm,
  type ProductFormValues,
} from "@slushomat/ui/composite/product-form";
import { ProductListRow } from "@slushomat/ui/composite/product-list-row";
import { createSupabaseBrowserClient } from "@slushomat/supabase";
import { env } from "@slushomat/env/web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  DeleteTemplateProductDialog,
  ReplaceTemplateProductImageDialog,
  TemplateProductUploadFailureDialog,
} from "@/components/template-product-dialogs";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_admin/products")({
  component: TemplateProductsPage,
});

const ALLOWED_PRODUCT_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

function resolveProductImageMime(file: File): "image/jpeg" | "image/png" | null {
  const t = file.type?.toLowerCase().split(";")[0]?.trim();
  if (t && ALLOWED_PRODUCT_IMAGE_TYPES.has(t)) {
    return t as "image/jpeg" | "image/png";
  }
  const n = file.name.toLowerCase();
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (n.endsWith(".png")) {
    return "image/png";
  }
  return null;
}

function validateProductImageFile(file: File): string | null {
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return `File is too large (max ${PRODUCT_IMAGE_MAX_BYTES / 1024 / 1024} MB).`;
  }
  if (!resolveProductImageMime(file)) {
    return "Only JPEG and PNG images are allowed.";
  }
  return null;
}

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

type ListRow = {
  id: string;
  name: string;
  priceInCents: number;
  taxRatePercent: 7 | 19;
  createdAt: Date;
  updatedAt: Date;
  imageUrl: string | null;
};

function TemplateProductsPage() {
  const queryClient = useQueryClient();
  const listQuery = useQuery(trpc.admin.templateProduct.list.queryOptions());

  const replaceDialogHadFileRef = useRef(false);
  const replaceApplyRef = useRef(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<ProductFormValues>({
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
  const [fileInputResetKey, setFileInputResetKey] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<ListRow | null>(null);

  const [uploadFailure, setUploadFailure] = useState<{
    templateProductId: string;
    label: string;
    file: File;
    message: string;
  } | null>(null);

  const invalidateList = () => {
    void queryClient.invalidateQueries(
      trpc.admin.templateProduct.list.queryFilter(),
    );
  };

  const createMutation = useMutation({
    ...trpc.admin.templateProduct.create.mutationOptions(),
    onSuccess: () => {
      invalidateList();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const updateMutation = useMutation({
    ...trpc.admin.templateProduct.update.mutationOptions(),
    onSuccess: () => {
      invalidateList();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const deleteMutation = useMutation({
    ...trpc.admin.templateProduct.delete.mutationOptions(),
    onSuccess: () => {
      toast.success("Template product removed");
      invalidateList();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const requestUploadMutation = useMutation(
    trpc.admin.templateProduct.requestImageUpload.mutationOptions(),
  );

  const confirmImageMutation = useMutation(
    trpc.admin.templateProduct.confirmTemplateProductImage.mutationOptions(),
  );

  const isUploading =
    requestUploadMutation.isPending || confirmImageMutation.isPending;

  const formBlocked =
    createMutation.isPending ||
    updateMutation.isPending ||
    isUploading;

  const resetForm = () => {
    setEditId(null);
    setFormValues({
      name: "",
      priceEuros: "",
      taxRatePercent: 19,
    });
    setPendingFile(null);
    setPendingPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setStagedFile(null);
  };

  const openCreate = () => {
    resetForm();
    setSheetOpen(true);
  };

  const openEdit = (row: ListRow) => {
    resetForm();
    setEditId(row.id);
    setFormValues({
      name: row.name,
      priceEuros: centsToEurosLabel(row.priceInCents),
      taxRatePercent: row.taxRatePercent,
    });
    setSheetOpen(true);
  };

  const applySelectedFile = (file: File) => {
    const err = validateProductImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setPendingPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(file);
    });
    setPendingFile(file);
  };

  const handlePickFile = (file: File) => {
    const row = listQuery.data?.find((r) => r.id === editId);
    if (editId && (row?.imageUrl || pendingFile)) {
      replaceApplyRef.current = false;
      replaceDialogHadFileRef.current = true;
      setStagedFile(file);
      setReplaceDialogOpen(true);
      return;
    }
    applySelectedFile(file);
  };

  const uploadImage = async (templateProductId: string, file: File) => {
    const reject = validateProductImageFile(file);
    if (reject) {
      throw new Error(reject);
    }
    const mime = resolveProductImageMime(file);
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
      templateProductId,
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
      templateProductId,
      objectPath: signed.path,
    });
  };

  const submitSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = formValues.name.trim();
    if (!trimmed) {
      toast.error("Name is required.");
      return;
    }
    const cents = eurosToCents(formValues.priceEuros);
    if (cents === null) {
      toast.error("Enter a valid price in euros.");
      return;
    }

    const fileToUpload = pendingFile;

    try {
      if (editId) {
        await updateMutation.mutateAsync({
          id: editId,
          name: trimmed,
          priceInCents: cents,
          taxRatePercent: formValues.taxRatePercent,
        });
        if (fileToUpload) {
          try {
            await uploadImage(editId, fileToUpload);
            toast.success("Template product updated.");
          } catch (err) {
            setUploadFailure({
              templateProductId: editId,
              label: trimmed,
              file: fileToUpload,
              message: errMessage(err),
            });
            return;
          }
        } else {
          toast.success("Template product updated.");
        }
        setSheetOpen(false);
        resetForm();
        return;
      }

      const created = await createMutation.mutateAsync({
        name: trimmed,
        priceInCents: cents,
        taxRatePercent: formValues.taxRatePercent,
      });

      if (fileToUpload) {
        try {
          await uploadImage(created.id, fileToUpload);
          toast.success("Template product created.");
        } catch (err) {
          setUploadFailure({
            templateProductId: created.id,
            label: trimmed,
            file: fileToUpload,
            message: errMessage(err),
          });
          return;
        }
      } else {
        toast.success("Template product created.");
      }
      setSheetOpen(false);
      resetForm();
    } catch {
      /* toast via mutation onError */
    }
  };

  const rows: ListRow[] = listQuery.data ?? [];
  const loading = listQuery.isPending;

  const editingRow = editId
    ? listQuery.data?.find((r) => r.id === editId)
    : undefined;
  const imagePreviewUrl =
    pendingPreviewUrl ?? editingRow?.imageUrl ?? null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Template products</h1>
          <p className="text-sm text-muted-foreground">
            Standard slush line items (name, price, VAT, optional image).
          </p>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          Add template product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catalog</CardTitle>
          <CardDescription>
            Global templates (not tied to an operator). Product images: JPEG or
            PNG, max 5&nbsp;MB, via Supabase signed uploads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <Empty className="border-none bg-transparent py-8">
              <EmptyHeader>
                <EmptyTitle>No template products yet</EmptyTitle>
                <EmptyDescription>
                  Add one to get started — name, price, VAT, optional image.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto border border-border px-3">
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
              {editId ? "Edit template product" : "New template product"}
            </SheetTitle>
            <SheetDescription>
              Name, gross-style price in euros, German VAT rate, optional image
              (JPEG or PNG, max 5&nbsp;MB).
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
            onSubmit={submitSheet}
          >
            <ProductForm
              idPrefix="tp"
              fileInputResetKey={fileInputResetKey}
              value={formValues}
              onChange={setFormValues}
              onPickFile={handlePickFile}
              onClearImage={
                pendingFile
                  ? () => {
                      setPendingFile(null);
                      setPendingPreviewUrl((prev) => {
                        if (prev) {
                          URL.revokeObjectURL(prev);
                        }
                        return null;
                      });
                    }
                  : undefined
              }
              disabled={formBlocked}
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
              <Button type="submit" size="sm" disabled={formBlocked}>
                Save
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <DeleteTemplateProductDialog
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
            { id: deleteTarget.id },
            {
              onSuccess: () => setDeleteTarget(null),
            },
          );
        }}
      />

      <ReplaceTemplateProductImageDialog
        open={replaceDialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            if (replaceDialogHadFileRef.current && !replaceApplyRef.current) {
              setFileInputResetKey((k) => k + 1);
            }
            replaceDialogHadFileRef.current = false;
            replaceApplyRef.current = false;
            setStagedFile(null);
          }
          setReplaceDialogOpen(o);
        }}
        pending={false}
        onConfirm={() => {
          replaceApplyRef.current = true;
          if (stagedFile) {
            applySelectedFile(stagedFile);
            setStagedFile(null);
          }
          setReplaceDialogOpen(false);
        }}
      />

      <TemplateProductUploadFailureDialog
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
              uploadFailure.templateProductId,
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
            { id: uploadFailure.templateProductId },
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
