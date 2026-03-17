/**
 * Admin Users page — lists users with "Open as user" impersonation handoff.
 * Flow: impersonateUser → oneTimeToken.generate → open new tab → stopImpersonating.
 */
import { authClient } from "@slushomat/auth/client";
import { env } from "@slushomat/env/web";
import { Button } from "@slushomat/ui/base/button";
import { Skeleton } from "@slushomat/ui/base/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/users")({
  component: UsersPage,
});

const USERS_QUERY_KEY = ["admin", "users"] as const;
const PAGE_SIZE = 50;

function UsersPage() {
  const [page, setPage] = useState(0);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

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

  const handleOpenAsUser = async (userId: string) => {
    setLoadingUserId(userId);
    try {
      await authClient.admin.impersonateUser({ userId });
      const genRes = await authClient.oneTimeToken.generate();
      const token =
        (genRes as { data?: { token?: string }; token?: string })?.data?.token ??
        (genRes as { data?: { token?: string }; token?: string })?.token;
      if (!token) throw new Error("No token received");

      const operatorUrl =
        env.VITE_OPERATOR_URL ??
        window.location.origin.replace("admin", "operator");
      window.open(`${operatorUrl}/auth/handoff?token=${token}`, "_blank");
      await authClient.admin.stopImpersonating();
    } catch (err) {
      toast.error("Could not open operator dashboard. Please try again.");
    } finally {
      setLoadingUserId(null);
    }
  };

  const users = usersQuery.data?.users ?? [];
  const isLoading = usersQuery.isLoading;
  const isError = usersQuery.isError;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-xl font-medium">Users</h1>

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
                const isBusy = loadingUserId === user.id;
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
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        aria-busy={isBusy}
                        onClick={() => handleOpenAsUser(user.id)}
                      >
                        {isBusy ? (
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
