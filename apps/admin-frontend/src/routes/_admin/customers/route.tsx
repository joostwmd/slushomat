import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout so `/customers` (index) and `/customers/$customerId` (detail) both render.
 * Without this Outlet, child routes never appear — the list would show for every path.
 */
export const Route = createFileRoute("/_admin/customers")({
  component: () => <Outlet />,
});
