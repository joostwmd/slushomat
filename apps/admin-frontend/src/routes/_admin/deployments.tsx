import { Button } from "@slushomat/ui/base/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import { Label } from "@slushomat/ui/base/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@slushomat/ui/base/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_admin/deployments")({
  component: AdminDeploymentsPage,
});

const SELECT_NONE = "__none__";

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

function AdminDeploymentsPage() {
  const queryClient = useQueryClient();
  const orgsQuery = useQuery(trpc.admin.listOrganizations.queryOptions());
  const listQuery = useQuery(trpc.admin.machineDeployment.list.queryOptions());
  const machinesQuery = useQuery(trpc.admin.machine.list.queryOptions());

  const [organizationId, setOrganizationId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [businessEntityId, setBusinessEntityId] = useState("");

  const entitiesQuery = useQuery({
    ...trpc.admin.businessEntity.listByOrganization.queryOptions({
      organizationId,
    }),
    enabled: !!organizationId,
  });

  const entities = useMemo(
    () =>
      (entitiesQuery.data ?? []).filter(
        (e) => !e.deletedAt,
      ),
    [entitiesQuery.data],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries(
      trpc.admin.machineDeployment.list.queryFilter(),
    );
  };

  const startMutation = useMutation({
    ...trpc.admin.machineDeployment.start.mutationOptions(),
    onSuccess: () => {
      toast.success("Deployment started");
      invalidate();
      setMachineId("");
      setBusinessEntityId("");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const endMutation = useMutation({
    ...trpc.admin.machineDeployment.end.mutationOptions(),
    onSuccess: () => {
      toast.success("Deployment ended");
      invalidate();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const handleStart = () => {
    if (!organizationId || !machineId || !businessEntityId) {
      toast.error("Select organization, machine, and business entity");
      return;
    }
    startMutation.mutate({
      machineId,
      businessEntityId,
      organizationId,
    });
  };

  const rows = listQuery.data ?? [];
  const openRows = rows.filter((r) => !r.endedAt);

  const orgSelectItems = useMemo(() => {
    const items: Record<string, ReactNode> = { [SELECT_NONE]: "— Select —" };
    for (const o of orgsQuery.data ?? []) {
      items[o.id] = `${o.name} (${o.slug})`;
    }
    return items;
  }, [orgsQuery.data]);

  const entitySelectItems = useMemo(() => {
    const items: Record<string, ReactNode> = { [SELECT_NONE]: "— Select —" };
    for (const e of entities) {
      items[e.id] = e.name;
    }
    return items;
  }, [entities]);

  const machineSelectItems = useMemo(() => {
    const items: Record<string, ReactNode> = { [SELECT_NONE]: "— Select —" };
    for (const m of machinesQuery.data ?? []) {
      const label = m.internalName.trim() || "Unnamed machine";
      items[m.id] = `${label} · v${m.versionNumber}`;
    }
    return items;
  }, [machinesQuery.data]);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-xl font-medium">Deployments</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Link a machine to a business entity for operator slot configuration.
        Starting a new deployment automatically closes any open deployment for
        that machine.
      </p>

      <Card className="mb-6 rounded-none border">
        <CardHeader>
          <CardTitle className="text-base">Start deployment</CardTitle>
          <CardDescription>
            Business entity must belong to the selected organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Organization</Label>
            <Select
              items={orgSelectItems}
              value={organizationId || SELECT_NONE}
              onValueChange={(v) => {
                setOrganizationId(v === SELECT_NONE ? "" : (v ?? ""));
                setBusinessEntityId("");
              }}
            >
              <SelectTrigger className="h-8 w-full rounded-none text-xs">
                <SelectValue placeholder="— Select —" />
              </SelectTrigger>
              <SelectContent position="popper" className="rounded-none">
                <SelectItem value={SELECT_NONE}>— Select —</SelectItem>
                {(orgsQuery.data ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name} ({o.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Business entity</Label>
            <Select
              items={entitySelectItems}
              value={businessEntityId || SELECT_NONE}
              onValueChange={(v) =>
                setBusinessEntityId(v === SELECT_NONE ? "" : (v ?? ""))
              }
              disabled={!organizationId}
            >
              <SelectTrigger className="h-8 w-full rounded-none text-xs">
                <SelectValue placeholder="— Select —" />
              </SelectTrigger>
              <SelectContent position="popper" className="rounded-none">
                <SelectItem value={SELECT_NONE}>— Select —</SelectItem>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Machine</Label>
            <Select
              items={machineSelectItems}
              value={machineId || SELECT_NONE}
              onValueChange={(v) =>
                setMachineId(v === SELECT_NONE ? "" : (v ?? ""))
              }
            >
              <SelectTrigger className="h-8 w-full rounded-none text-xs">
                <SelectValue placeholder="— Select —" />
              </SelectTrigger>
              <SelectContent position="popper" className="rounded-none">
                <SelectItem value={SELECT_NONE}>— Select —</SelectItem>
                {(machinesQuery.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.internalName.trim() || "Unnamed machine"} · v
                    {m.versionNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button
              type="button"
              className="rounded-none"
              onClick={handleStart}
              disabled={
                startMutation.isPending ||
                !organizationId ||
                !machineId ||
                !businessEntityId
              }
            >
              Start deployment
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-none border">
        <CardHeader>
          <CardTitle className="text-base">Open deployments</CardTitle>
          <CardDescription>
            {openRows.length} open · {rows.length} total in history
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {openRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">None open.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-2 font-medium">#</th>
                  <th className="py-2 pr-2 font-medium">Machine</th>
                  <th className="py-2 pr-2 font-medium">Entity</th>
                  <th className="py-2 pr-2 font-medium">Started</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {openRows.map((d, index) => (
                  <tr key={d.id} className="border-b border-border/60">
                    <td className="py-2 pr-2 tabular-nums text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="py-2 pr-2">
                      <span className="text-xs font-medium">
                        {d.machineDisplayName}
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      <span className="text-xs font-medium">
                        {d.businessEntityDisplayName}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-muted-foreground">
                      {d.startedAt.toLocaleString()}
                    </td>
                    <td className="py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-none text-xs"
                        disabled={endMutation.isPending}
                        onClick={() => {
                          const ok = window.confirm("End this deployment?");
                          if (!ok) return;
                          endMutation.mutate({ deploymentId: d.id });
                        }}
                      >
                        End
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
