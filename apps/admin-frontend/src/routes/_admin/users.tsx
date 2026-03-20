/**
 * Admin Users page — lists users with "Open as user" impersonation handoff
 * and optional password reset (tRPC generateUserPassword).
 * Handoff: tRPC `admin.createOperatorHandoffToken` chains impersonation + OTT on the
 * server so the admin browser session stays admin and the token targets the target user.
 */
import { authClient } from "@slushomat/auth/client";
import { env } from "@slushomat/env/web";
import { Button } from "@slushomat/ui/base/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slushomat/ui/base/dialog";
import { Label } from "@slushomat/ui/base/label";
import { Skeleton } from "@slushomat/ui/base/skeleton";
import { cn } from "@slushomat/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_admin/users")({
  component: UsersPage,
});

const USERS_QUERY_KEY = ["admin", "users"] as const;
const PAGE_SIZE = 50;

const textareaClassName = cn(
  "flex min-h-[72px] w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1.5 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-xs dark:bg-input/30 dark:disabled:bg-input/80",
);

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

type RowBusy = { userId: string; action: "open" | "password" } | null;

function UsersPage() {
  const [page, setPage] = useState(0);
  const [rowBusy, setRowBusy] = useState<RowBusy>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: [...USERS_QUERY_KEY, page],
    queryFn: async () => {
      const res = await authClient.admin.listUsers({
        query: {
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          sortBy: "createdAt",
          sortDirection: "desc",
        },
      });
      if (res.error) throw res.error;
      return res.data ?? [];
    },
  });

  const generatePasswordMutation = useMutation({
    ...trpc.admin.generateUserPassword.mutationOptions(),
    onError: (e) => toast.error(errMessage(e)),
  });

  const operatorHandoffMutation = useMutation({
    ...trpc.admin.createOperatorHandoffToken.mutationOptions(),
    onError: (e) => toast.error(errMessage(e)),
  });

  const handleOpenAsUser = async (userId: string) => {
    setRowBusy({ userId, action: "open" });
    try {
      const { token } = await operatorHandoffMutation.mutateAsync({ userId });
      const operatorUrl =
        env.VITE_OPERATOR_URL ??
        window.location.origin.replace("admin", "operator");
      window.open(
        `${operatorUrl}/auth/handoff?token=${encodeURIComponent(token)}`,
        "_blank",
      );
    } catch {
      /* onError toasts */
    } finally {
      setRowBusy(null);
    }
  };

  const handleRequestNewPassword = (userId: string) => {
    const ok = window.confirm(
      "Generate a new password for this user? Their current password will stop working immediately.",
    );
    if (!ok) return;

    setRowBusy({ userId, action: "password" });
    generatePasswordMutation.mutate(
      { userId },
      {
        onSuccess: (data) => setRevealedPassword(data.password),
        onSettled: () => setRowBusy(null),
      },
    );
  };

  const users = usersQuery.data?.users ?? [];
  const isLoading = usersQuery.isLoading;
  const isError = usersQuery.isError;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-xl font-medium">Users</h1>

      <Dialog
        open={revealedPassword !== null}
        onOpenChange={(open) => {
          if (!open) setRevealedPassword(null);
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>New password</DialogTitle>
            <DialogDescription>
              Copy this password now. It will not be shown again after you close
              this dialog.
            </DialogDescription>
          </DialogHeader>
          {revealedPassword ? (
            <div
              className="rounded-none border border-amber-500/40 bg-amber-500/5 p-3"
              role="region"
              aria-label="Generated password — copy now"
            >
              <Label
                htmlFor="admin-user-password-once"
                className="text-xs text-muted-foreground"
              >
                Password
              </Label>
              <textarea
                id="admin-user-password-once"
                readOnly
                className={cn(textareaClassName, "mt-1 font-mono")}
                value={revealedPassword}
                rows={3}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!revealedPassword}
              onClick={async () => {
                if (!revealedPassword) return;
                await navigator.clipboard.writeText(revealedPassword);
                toast.success("Password copied");
              }}
            >
              Copy password
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setRevealedPassword(null)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Failed to load users. Please try again.
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-none border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const user = u as {
                  id: string;
                  name?: string;
                  email?: string;
                  role?: string;
                  createdAt?: Date | string;
                };
                const isThisRowBusy = rowBusy?.userId === user.id;
                const openLoading = isThisRowBusy && rowBusy?.action === "open";
                const passwordLoading =
                  isThisRowBusy && rowBusy?.action === "password";
                return (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2">{user.name ?? "—"}</td>
                    <td className="px-4 py-2">{user.email ?? "—"}</td>
                    <td className="px-4 py-2">{user.role ?? "—"}</td>
                    <td className="px-4 py-2">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isThisRowBusy}
                          aria-busy={openLoading}
                          onClick={() => handleOpenAsUser(user.id)}
                        >
                          {openLoading ? (
                            <>
                              <Loader2Icon
                                className="size-3.5 animate-spin"
                                aria-hidden
                              />
                              <span className="ml-1.5">Opening...</span>
                            </>
                          ) : (
                            "Open as user"
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isThisRowBusy}
                          aria-busy={passwordLoading}
                          onClick={() => handleRequestNewPassword(user.id)}
                        >
                          {passwordLoading ? (
                            <>
                              <Loader2Icon
                                className="size-3.5 animate-spin"
                                aria-hidden
                              />
                              <span className="ml-1.5">Working...</span>
                            </>
                          ) : (
                            "New password"
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && users.length === 0 && !isError && (
        <p className="mt-4 text-sm text-muted-foreground">No users found.</p>
      )}

      {!isLoading && users.length >= PAGE_SIZE && (
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
