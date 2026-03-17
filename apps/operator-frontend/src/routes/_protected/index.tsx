import { authClient } from "@slushomat/auth/client";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    const activeSlug = (session.data?.session as { activeOrganizationSlug?: string } | undefined)
      ?.activeOrganizationSlug;
    if (activeSlug) {
      throw redirect({
        to: "/$orgSlug/dashboard",
        params: { orgSlug: activeSlug },
        throw: true,
      });
    }
    throw redirect({ to: "/organizations", throw: true });
  },
  component: () => null,
});
