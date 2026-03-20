import { Button } from "@slushomat/ui/base/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import { Input } from "@slushomat/ui/base/input";
import { Label } from "@slushomat/ui/base/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@slushomat/ui/base/sheet";
import { createSupabaseBrowserClient } from "@slushomat/supabase";
import { env } from "@slushomat/env/web";
import { cn } from "@slushomat/ui/lib/utils";
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

const selectClassName = cn(
  "h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:text-xs dark:bg-input/30",
);

/** Keep in sync with `TEMPLATE_PRODUCT_IMAGE_MAX_BYTES` on the server. */
const TEMPLATE_PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

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
  if (file.size > TEMPLATE_PRODUCT_IMAGE_MAX_BYTES) {
    return `File is too large (max ${TEMPLATE_PRODUCT_IMAGE_MAX_BYTES / 1024 / 1024} MB).`;
  }
  if (!resolveProductImageMime(file)) {
    return "Only JPEG and PNG images are allowed.";
  }
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [priceEuros, setPriceEuros] = useState("");
  const [taxRate, setTaxRate] = useState<7 | 19>(19);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(
    null,
  );

  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);

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

  const resetForm = () => {
    setEditId(null);
    setName("");
    setPriceEuros("");
    setTaxRate(19);
    setPendingFile(null);
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl(null);
    }
    setStagedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openCreate = () => {
    resetForm();
    setSheetOpen(true);
  };

  const openEdit = (row: ListRow) => {
    resetForm();
    setEditId(row.id);
    setName(row.name);
    setPriceEuros(centsToEurosLabel(row.priceInCents));
    setTaxRate(row.taxRatePercent);
    setSheetOpen(true);
  };

  const applySelectedFile = (file: File) => {
    const err = validateProductImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const row = listQuery.data?.find((r) => r.id === editId);
    if (editId && (row?.imageUrl || pendingFile)) {
      const err = validateProductImageFile(file);
      if (err) {
        toast.error(err);
        e.target.value = "";
        return;
      }
      setStagedFile(file);
      setReplaceDialogOpen(true);
      e.target.value = "";
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
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required.");
      return;
    }
    const cents = eurosToCents(priceEuros);
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
          taxRatePercent: taxRate,
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
        taxRatePercent: taxRate,
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

  const handleDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    const file = ev.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    const err = validateProductImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    const row = listQuery.data?.find((r) => r.id === editId);
    if (editId && (row?.imageUrl || pendingFile)) {
      setStagedFile(file);
      setReplaceDialogOpen(true);
      return;
    }
    applySelectedFile(file);
  };

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
            <p className="text-sm text-muted-foreground">
              No template products yet. Add one to get started.
            </p>
          ) : (
            <div className="overflow-x-auto border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">Image</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Tax</th>
                    <th className="px-3 py-2 font-medium text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2">
                        {row.imageUrl ? (
                          <img
                            src={row.imageUrl}
                            alt=""
                            className="size-10 border border-border object-cover"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2 tabular-nums">
                        €{centsToEurosLabel(row.priceInCents)}
                      </td>
                      <td className="px-3 py-2">{row.taxRatePercent}%</td>
                      <td className="px-3 py-2 text-right">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            <div className="space-y-1.5">
              <Label htmlFor="tp-name">Name</Label>
              <Input
                id="tp-name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tp-price">Price (€)</Label>
              <Input
                id="tp-price"
                type="text"
                inputMode="decimal"
                placeholder="2.50"
                value={priceEuros}
                onChange={(ev) => setPriceEuros(ev.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tp-tax">Tax rate</Label>
              <select
                id="tp-tax"
                className={selectClassName}
                value={taxRate}
                onChange={(ev) =>
                  setTaxRate(Number(ev.target.value) as 7 | 19)
                }
              >
                <option value={7}>7% (reduced)</option>
                <option value={19}>19% (standard)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="tp-image-input">Image</Label>
                <p
                  id="tp-image-hint"
                  className="text-[11px] text-muted-foreground"
                >
                  JPEG or PNG only · max 5&nbsp;MB
                </p>
              </div>
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-input bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground transition-colors hover:bg-muted/30",
                )}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={handleDrop}
              >
                {pendingPreviewUrl ? (
                  <img
                    src={pendingPreviewUrl}
                    alt=""
                    className="max-h-24 border border-border object-contain"
                  />
                ) : editId &&
                  listQuery.data?.find((r) => r.id === editId)?.imageUrl ? (
                  <img
                    src={
                      listQuery.data.find((r) => r.id === editId)!.imageUrl!
                    }
                    alt=""
                    className="max-h-24 border border-border object-contain"
                  />
                ) : (
                  <span>Click or drop a JPEG or PNG (max 5&nbsp;MB)</span>
                )}
                <input
                  id="tp-image-input"
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                  className="hidden"
                  aria-describedby="tp-image-hint"
                  onChange={onFileInputChange}
                />
              </div>
              {pendingFile ? (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] text-muted-foreground">
                    {pendingFile.name} · {formatFileSize(pendingFile.size)} · limit
                    5&nbsp;MB
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 self-start px-0 text-xs"
                    onClick={() => {
                      setPendingFile(null);
                      if (pendingPreviewUrl) {
                        URL.revokeObjectURL(pendingPreviewUrl);
                        setPendingPreviewUrl(null);
                      }
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    Clear selected file
                  </Button>
                </div>
              ) : null}
            </div>
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
                  requestUploadMutation.isPending ||
                  confirmImageMutation.isPending
                }
              >
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
              prev
                ? { ...prev, message: errMessage(err) }
                : prev,
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
