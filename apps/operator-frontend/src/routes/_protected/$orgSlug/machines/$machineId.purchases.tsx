import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_protected/$orgSlug/machines/$machineId/purchases",
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$orgSlug/machines/$machineId",
      params: {
        orgSlug: params.orgSlug,
        machineId: params.machineId,
      },
    });
  },
});
