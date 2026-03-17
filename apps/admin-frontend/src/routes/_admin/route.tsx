import { authClient } from "@slushomat/auth/client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin")({
  component: AdminLayoutComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data || session.data.user.role !== "admin") {
      throw redirect({ to: "/sign-in", throw: true });
    }
    if (session.data.user?.role !== "admin") {
      throw redirect({ to: "/sign-in", throw: true });
    }
  },
});

function AdminLayoutComponent() {
  return (
    <div>
      <Outlet />
    </div>
  );
}
