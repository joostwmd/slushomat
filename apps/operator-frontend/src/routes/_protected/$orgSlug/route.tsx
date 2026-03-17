import { authClient } from "@slushomat/auth/client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/$orgSlug")({
  component: OrgSlugLayout,
  beforeLoad: async ({ params }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/sign-in", throw: true });
    }
    const activeSlug = (session.data.session as { activeOrganizationSlug?: string } | undefined)
      ?.activeOrganizationSlug;
    if (params.orgSlug !== activeSlug) {
      throw redirect({ to: "/organizations", throw: true });
    }
    return { orgSlug: params.orgSlug };
  },
});

function OrgSlugLayout() {
  return <Outlet />;
}
