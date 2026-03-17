import { authClient } from "@slushomat/auth/client";
import { SidebarInset, SidebarProvider } from "@slushomat/ui/base/sidebar";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { OperatorAppSidebar } from "@/components/operator-app-sidebar";

export const Route = createFileRoute("/_protected")({
  component: ProtectedLayoutComponent,
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/sign-in", throw: true });
    }

    const noOrgRequiredPaths = ["/invitations", "/organizations"];
    const isNoOrgPath = noOrgRequiredPaths.includes(location.pathname);

    if (!isNoOrgPath) {
      const { data: orgs } = await authClient.organization.list();
      if (!orgs?.length) {
        throw redirect({ to: "/invitations", throw: true });
      }
    }
  },
});

function ProtectedLayoutComponent() {
  return (
    <SidebarProvider>
      <OperatorAppSidebar />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
