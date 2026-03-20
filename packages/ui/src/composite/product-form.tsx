"use client";

import * as React from "react";

import { Button } from "@slushomat/ui/base/button";
import { Input } from "@slushomat/ui/base/input";
import { Label } from "@slushomat/ui/base/label";
import { cn } from "@slushomat/ui/lib/utils";

/** Keep in sync with server max upload / validation (e.g. template product image limit). */
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_PRODUCT_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

const selectClassName = cn(
  "h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:text-xs dark:bg-input/30",
);

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export type ProductTaxRate = 7 | 19;

export interface ProductFormValues {
  name: string;
  /** Gross-style price in euros as entered by the user; parent parses to cents if needed. */
  priceEuros: string;
  taxRatePercent: ProductTaxRate;
}

export interface ProductFormProps {
  value: ProductFormValues;
  onChange: (next: ProductFormValues) => void;
  onPickFile: (file: File) => void;
  onClearImage?: () => void;
  /** Bump to remount the hidden file input (e.g. replace-image dialog cancelled after a pick). */
  fileInputResetKey?: number;
  disabled?: boolean;
  isUploading?: boolean;
  /** Remote URL or object URL for the current image preview. */
  imagePreviewUrl?: string | null;
  /** Optional selected file metadata for a short status line (parent-owned `File`). */
  selectedFile?: File | null;
  idPrefix?: string;
  className?: string;
}

export function ProductForm({
  value,
  onChange,
  onPickFile,
  onClearImage,
  fileInputResetKey = 0,
  disabled = false,
  isUploading = false,
  imagePreviewUrl = null,
  selectedFile = null,
  idPrefix = "product-form",
  className,
}: ProductFormProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pickError, setPickError] = React.useState<string | null>(null);

  const blocked = disabled || isUploading;

  const applyFile = (file: File | undefined) => {
    if (!file) {
      return;
    }
    const err = validateProductImageFile(file);
    if (err) {
      setPickError(err);
      return;
    }
    setPickError(null);
    onPickFile(file);
  };

  const handleFileInputChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    applyFile(ev.target.files?.[0]);
  };

  const handleDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    applyFile(ev.dataTransfer.files?.[0]);
  };

  const handleClearImage = () => {
    setPickError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClearImage?.();
  };

  const nameId = `${idPrefix}-name`;
  const priceId = `${idPrefix}-price`;
  const taxId = `${idPrefix}-tax`;
  const imageInputId = `${idPrefix}-image`;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="space-y-1.5">
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          value={value.name}
          onChange={(ev) => onChange({ ...value, name: ev.target.value })}
          autoComplete="off"
          disabled={blocked}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={priceId}>Price (€)</Label>
        <Input
          id={priceId}
          type="text"
          inputMode="decimal"
          placeholder="2.50"
          value={value.priceEuros}
          onChange={(ev) => onChange({ ...value, priceEuros: ev.target.value })}
          disabled={blocked}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={taxId}>Tax rate</Label>
        <select
          id={taxId}
          className={selectClassName}
          value={value.taxRatePercent}
          onChange={(ev) =>
            onChange({
              ...value,
              taxRatePercent: Number(ev.target.value) as ProductTaxRate,
            })
          }
          disabled={blocked}
        >
          <option value={7}>7% (reduced)</option>
          <option value={19}>19% (standard)</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={imageInputId}>Image</Label>
          <p
            id={`${imageInputId}-hint`}
            className="text-[11px] text-muted-foreground"
          >
            JPEG or PNG only · max {PRODUCT_IMAGE_MAX_BYTES / 1024 / 1024}&nbsp;MB
          </p>
        </div>
        {pickError ? (
          <p className="text-xs text-destructive" role="alert">
            {pickError}
          </p>
        ) : null}
        <div
          role="button"
          tabIndex={blocked ? -1 : 0}
          aria-disabled={blocked}
          className={cn(
            "flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-input bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground transition-colors hover:bg-muted/30",
            blocked && "pointer-events-none opacity-50",
          )}
          onKeyDown={(ev) => {
            if (blocked) {
              return;
            }
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onClick={() => {
            if (!blocked) {
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(ev) => {
            if (!blocked) {
              ev.preventDefault();
            }
          }}
          onDrop={blocked ? undefined : handleDrop}
        >
          {isUploading ? (
            <span className="text-muted-foreground">Uploading…</span>
          ) : imagePreviewUrl ? (
            <img
              src={imagePreviewUrl}
              alt=""
              className="max-h-24 border border-border object-contain"
            />
          ) : (
            <span>Click or drop a JPEG or PNG (max 5&nbsp;MB)</span>
          )}
          <input
            key={fileInputResetKey}
            id={imageInputId}
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            className="hidden"
            aria-describedby={`${imageInputId}-hint`}
            disabled={blocked}
            onChange={handleFileInputChange}
          />
        </div>
        {selectedFile ? (
          <div className="flex flex-col gap-1">
            <p className="text-[11px] text-muted-foreground">
              {selectedFile.name} · {formatFileSize(selectedFile.size)} · limit 5&nbsp;MB
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 self-start px-0 text-xs"
              onClick={handleClearImage}
              disabled={blocked}
            >
              Clear selected file
            </Button>
          </div>
        ) : imagePreviewUrl && onClearImage ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 self-start px-0 text-xs"
            onClick={handleClearImage}
            disabled={blocked}
          >
            Remove image
          </Button>
        ) : null}
      </div>
    </div>
  );
}
