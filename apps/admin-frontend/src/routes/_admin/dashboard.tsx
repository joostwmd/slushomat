import { buttonVariants } from "@slushomat/ui/base/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "@slushomat/ui/lib/utils";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_admin/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const healthCheck = useQuery(trpc.healthCheck.queryOptions());

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-xl font-medium">Admin Dashboard</h1>
      <p className="mb-4">admin dashboard content</p>
      <div className="flex gap-2">
        <Link
          to="/users"
          className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}
        >
          Users
        </Link>
        <Link
          to="/create-customer"
          className={cn(buttonVariants(), "inline-flex")}
        >
          Create customer
        </Link>
      </div>
    </div>
  );
}
