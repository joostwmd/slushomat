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
import { Input } from "@slushomat/ui/base/input";
import { Label } from "@slushomat/ui/base/label";
import { useMutation } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const resetFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const mutation = useMutation({
    ...trpc.account.changePassword.mutationOptions(),
    onSuccess: () => {
      toast.success("Password updated");
      resetFields();
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) resetFields();
    onOpenChange(next);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    mutation.mutate({ currentPassword, newPassword });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one (at least 8
              characters).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <Label
                htmlFor="change-password-current"
                className="text-xs text-muted-foreground"
              >
                Current password
              </Label>
              <Input
                id="change-password-current"
                type="password"
                name="current-password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(ev) => setCurrentPassword(ev.target.value)}
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="change-password-new"
                className="text-xs text-muted-foreground"
              >
                New password
              </Label>
              <Input
                id="change-password-new"
                type="password"
                name="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(ev) => setNewPassword(ev.target.value)}
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="change-password-confirm"
                className="text-xs text-muted-foreground"
              >
                Confirm new password
              </Label>
              <Input
                id="change-password-confirm"
                type="password"
                name="confirm-new-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(ev) => setConfirmPassword(ev.target.value)}
                disabled={mutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="gap-2"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              ) : null}
              Update password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
