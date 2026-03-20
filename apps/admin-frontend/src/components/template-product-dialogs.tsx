"use client";

import { Button } from "@slushomat/ui/base/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slushomat/ui/base/dialog";

type UploadFailureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productLabel: string;
  errorMessage: string;
  onRetry: () => void;
  onDeleteDraft: () => void;
  onKeepWithoutImage: () => void;
  pending: boolean;
};

export function TemplateProductUploadFailureDialog({
  open,
  onOpenChange,
  productLabel,
  errorMessage,
  onRetry,
  onDeleteDraft,
  onKeepWithoutImage,
  pending,
}: UploadFailureDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!pending} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            Image upload failed
          </DialogTitle>
          <DialogDescription className="text-xs">
            Could not upload an image for <strong>{productLabel}</strong>.
            <span className="mt-2 block font-mono text-[11px] text-muted-foreground">
              {errorMessage}
            </span>
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Choose what to do next (open question from the UX spec).
        </p>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-stretch">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onKeepWithoutImage}
          >
            Keep without image
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={onDeleteDraft}
          >
            Delete this product
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={onRetry}>
            Retry upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onConfirm: () => void;
  pending: boolean;
};

export function DeleteTemplateProductDialog({
  open,
  onOpenChange,
  name,
  onConfirm,
  pending,
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!pending} className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            Delete template product?
          </DialogTitle>
          <DialogDescription className="text-xs">
            <strong>{name}</strong> and its linked image will be removed. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={onConfirm}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ReplaceImageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
};

export function ReplaceTemplateProductImageDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
}: ReplaceImageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!pending} className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            Replace image?
          </DialogTitle>
          <DialogDescription className="text-xs">
            This product already has an image. Uploading a new file will replace
            it in storage. New file must be JPEG or PNG and at most 5&nbsp;MB.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={onConfirm}
          >
            Replace image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
