import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout so `/$orgSlug/machines` (index list) and `/$orgSlug/machines/$machineId` both render.
 * Without Outlet, the machine detail route never appears — the list would show for every path.
 */
export const Route = createFileRoute("/_protected/$orgSlug/machines")({
  component: () => <Outlet />,
});
