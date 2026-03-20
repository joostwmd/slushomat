import { Button } from "@slushomat/ui/base/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@slushomat/ui/base/empty";
import { Input } from "@slushomat/ui/base/input";
import { Skeleton } from "@slushomat/ui/base/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@slushomat/ui/base/table";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_admin/customers")({
  component: CustomersPage,
});

function formatRelativeCreated(d: Date): string {
  const now = Date.now();
  const t = d.getTime();
  const sec = Math.floor((now - t) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `${day}d ago`;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(d);
}

function CustomersPage() {
  const navigate = useNavigate();
  const listQuery = useQuery(trpc.admin.customer.list.queryOptions({}));
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const data = listQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) => r.name.toLowerCase().includes(q));
  }, [listQuery.data, search]);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-medium">Customers</h1>
        <Button render={<Link to="/create-customer" />} size="sm">
          New Customer
        </Button>
      </div>

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 text-xs"
        />
      </div>

      {listQuery.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty className="rounded-none border">
          <EmptyHeader>
            <EmptyTitle>No customers yet.</EmptyTitle>
            <EmptyDescription>
              Create an organization to get started.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Active machines</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() =>
                  navigate({
                    to: "/customers/$customerId",
                    params: { customerId: row.id },
                  })
                }
              >
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  <code className="text-[10px] text-muted-foreground">
                    {row.slug}
                  </code>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.machineCount}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatRelativeCreated(row.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
