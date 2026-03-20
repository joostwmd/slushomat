import { authClient } from "@slushomat/auth/client";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@slushomat/ui/base/sidebar";
import { Separator } from "@slushomat/ui/base/separator";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { OperatorAppSidebar } from "@/components/operator-app-sidebar";
import { OperatorBreadcrumbs } from "@/components/operator-breadcrumbs";

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
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="data-[orientation=vertical]:h-4"
            />
          </div>
          <OperatorBreadcrumbs />
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
