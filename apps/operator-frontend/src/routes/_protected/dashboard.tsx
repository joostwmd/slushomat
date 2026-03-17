import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/dashboard")({
  component: OperatorDashboard,
});

function OperatorDashboard() {
  const healthCheck = useQuery(trpc.healthCheck.queryOptions());

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-xl font-medium">Operator Dashboard</h1>
      <p>operator dashbaord content</p>
    </div>
  );
}
