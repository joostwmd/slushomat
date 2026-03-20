import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@slushomat/ui/base/empty";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CpuIcon } from "lucide-react";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/$orgSlug/machines")({
  component: OperatorMachinesPage,
});

function OperatorMachinesPage() {
  const { orgSlug } = Route.useParams();
  const listQuery = useQuery(
    trpc.operator.machine.list.queryOptions({ orgSlug }),
  );

  const machines = listQuery.data ?? [];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-xl font-medium">Machines</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Machines appear here once your organization has an operator contract
        for them. Open a machine to configure dispenser slots (requires an
        active deployment from your admin).
      </p>

      {listQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : machines.length === 0 ? (
        <Empty className="rounded-none border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CpuIcon />
            </EmptyMedia>
            <EmptyTitle>No machines yet</EmptyTitle>
            <EmptyDescription className="max-w-md">
              There are no machines linked to this organization. An admin must
              create an operator contract that ties a machine to one of your
              business entities. After that, the machine will show up here and
              you can open it to assign products to slots.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {machines.map((m) => (
            <li key={m.id}>
              <Link
                to="/$orgSlug/machines/$machineId"
                params={{ orgSlug, machineId: m.id }}
                className="block outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full rounded-none border transition-colors hover:bg-muted/40">
                  <CardHeader className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <CpuIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                      {m.disabled ? (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Disabled
                        </span>
                      ) : null}
                    </div>
                    <CardTitle className="font-mono text-sm leading-tight">
                      {m.id}
                    </CardTitle>
                    <CardDescription>
                      Model {m.versionNumber}
                    </CardDescription>
                  </CardHeader>
                  {m.comments.trim() ? (
                    <CardContent className="pt-0">
                      <p className="line-clamp-3 text-xs text-muted-foreground">
                        {m.comments}
                      </p>
                    </CardContent>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
