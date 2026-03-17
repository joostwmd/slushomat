import { authClient } from "@slushomat/auth/client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected")({
  component: ProtectedLayoutComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    console.log("session", session);
    if (!session.data) {
      throw redirect({ to: "/sign-in", throw: true });
    }
  },
});

function ProtectedLayoutComponent() {
  return (
    <div>
      <Outlet />
    </div>
  );
}
