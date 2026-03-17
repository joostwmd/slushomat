import { authClient } from "@slushomat/auth/client";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@slushomat/ui/base/sidebar";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AdminAppSidebar } from "@/components/admin-app-sidebar";
import { RoleBlockScreen } from "@/components/role-block-screen";

export const Route = createFileRoute("/_admin")({
  component: AdminLayoutComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/sign-in", throw: true });
    }
    if (session.data.user.role !== "admin") {
      return { blocked: true, session: session.data };
    }
    return { blocked: false, session: session.data };
  },
});

function AdminLayoutComponent() {
  const { blocked, session } = Route.useRouteContext();

  return (
    <SidebarProvider>
      <AdminAppSidebar user={session.user} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        {blocked ? <RoleBlockScreen /> : <Outlet />}
      </SidebarInset>
    </SidebarProvider>
  );
}
