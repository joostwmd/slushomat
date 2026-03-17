import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-xl font-medium">Customers</h1>
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}
