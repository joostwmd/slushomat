import { authClient } from "@slushomat/auth/client";
import { buttonVariants } from "@slushomat/ui/base/button";
import { Card, CardContent, CardHeader, CardTitle } from "@slushomat/ui/base/card";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, XIcon, Loader2Icon } from "lucide-react";

export const Route = createFileRoute("/_protected/invitations")({
  component: InvitationsPage,
});

function InvitationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: invitations, isLoading, error } = useQuery({
    queryKey: ["organization", "listUserInvitations"],
    queryFn: async () => {
      const result = await authClient.organization.listUserInvitations();
      return Array.isArray(result) ? result : (result as { data?: unknown[] })?.data ?? [];
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (invitationId: string) =>
      authClient.organization.acceptInvitation({ invitationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organization"] });
      await authClient.getSession(); // refresh session
      const { data: orgs } = await authClient.organization.list();
      const slug = orgs?.[0]?.slug;
      if (slug) {
        navigate({ to: "/$orgSlug/dashboard", params: { orgSlug: slug } });
      } else {
        navigate({ to: "/organizations" });
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (invitationId: string) =>
      authClient.organization.rejectInvitation({ invitationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "listUserInvitations"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2Icon className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <p className="text-destructive">Failed to load invitations.</p>
      </div>
    );
  }

  const list = invitations ?? [];

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-muted-foreground">
              You have no pending invitations. Check back later or ask an admin to invite you
              to an organization.
            </p>
          ) : (
            <ul className="space-y-4">
              {(list as Array<{ id: string; organizationName?: string; role?: string }>).map(
                (inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">{inv.organizationName ?? "Organization"}</p>
                    {inv.role && (
                      <p className="text-sm text-muted-foreground">Role: {inv.role}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={buttonVariants({ variant: "default", size: "sm" })}
                      disabled={
                        acceptMutation.isPending || rejectMutation.isPending
                      }
                      onClick={() => acceptMutation.mutate(inv.id)}
                    >
                      {acceptMutation.isPending && acceptMutation.variables === inv.id ? (
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckIcon className="h-4 w-4" />
                      )}
                      <span className="ml-1">Accept</span>
                    </button>
                    <button
                      type="button"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      disabled={
                        acceptMutation.isPending || rejectMutation.isPending
                      }
                      onClick={() => rejectMutation.mutate(inv.id)}
                    >
                      <XIcon className="h-4 w-4" />
                      <span className="ml-1">Reject</span>
                    </button>
                  </div>
                </li>
              )
            )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
