import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout so `/customers/$id` (index tabs) and `/customers/$id/machines/$machineId` both render.
 * Without Outlet, the nested machine route never appears — the parent would always show the table.
 */
export const Route = createFileRoute("/_admin/customers/$customerId")({
  component: () => <Outlet />,
});
