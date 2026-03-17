import { authClient } from "@slushomat/auth/client";
import { buttonVariants } from "@slushomat/ui/base/button";
import { Card, CardContent, CardHeader, CardTitle } from "@slushomat/ui/base/card";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";

export const Route = createFileRoute("/_protected/organizations")({
  component: OrganizationsPage,
});

function OrganizationsPage() {
  const navigate = useNavigate();

  const { data: orgs, isLoading, error } = useQuery({
    queryKey: ["organization", "list"],
    queryFn: async () => {
      const { data } = await authClient.organization.list();
      return data ?? [];
    },
  });

  const handleSelectOrg = async (org: { id: string; slug: string }) => {
    const { error } = await authClient.organization.setActive({
      organizationId: org.id,
      organizationSlug: org.slug,
    });
    if (!error) {
      navigate({ to: "/$orgSlug/dashboard", params: { orgSlug: org.slug } });
    }
  };

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
        <p className="text-destructive">Failed to load organizations.</p>
      </div>
    );
  }

  const list = orgs ?? [];

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Select Organization</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-muted-foreground">
              You are not a member of any organization yet. Check your pending invitations or
              ask an admin to add you.
            </p>
          ) : (
            <ul className="space-y-3">
              {list.map((org: { id: string; slug: string; name: string }) => (
                <li key={org.id}>
                  <button
                    type="button"
                    className={buttonVariants({
                      variant: "outline",
                      className: "w-full justify-start",
                    })}
                    onClick={() => handleSelectOrg(org)}
                  >
                    <span className="font-medium">{org.name}</span>
                    <span className="ml-2 text-muted-foreground">({org.slug})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
