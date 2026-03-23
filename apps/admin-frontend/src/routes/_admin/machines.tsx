import { Button } from "@slushomat/ui/base/button";
import { Checkbox } from "@slushomat/ui/base/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import { Input } from "@slushomat/ui/base/input";
import { Label } from "@slushomat/ui/base/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@slushomat/ui/base/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@slushomat/ui/base/sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "@slushomat/ui/lib/utils";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_admin/machines")({
  component: MachinesPage,
});

const textareaClassName = cn(
  "flex min-h-[88px] w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1.5 text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-xs dark:bg-input/30 dark:disabled:bg-input/80",
);

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

type VersionRow = {
  id: string;
  versionNumber: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

type MachineListRow = {
  id: string;
  machineVersionId: string;
  versionNumber: string;
  internalName: string;
  comments: string;
  disabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function MachinesPage() {
  const queryClient = useQueryClient();
  const versionsQuery = useQuery(trpc.admin.machineVersion.list.queryOptions());
  const machinesQuery = useQuery(trpc.admin.machine.list.queryOptions());

  const [versionSheetOpen, setVersionSheetOpen] = useState(false);
  const [versionEdit, setVersionEdit] = useState<VersionRow | null>(null);
  const [versionNumber, setVersionNumber] = useState("");
  const [versionDescription, setVersionDescription] = useState("");

  const [machineSheetOpen, setMachineSheetOpen] = useState(false);
  const [machineEditId, setMachineEditId] = useState<string | null>(null);
  const [machineVersionId, setMachineVersionId] = useState("");
  const [machineInternalName, setMachineInternalName] = useState("");
  const [machineComments, setMachineComments] = useState("");
  const [machineDisabled, setMachineDisabled] = useState(false);
  const [apiKeySecret, setApiKeySecret] = useState<string | null>(null);

  const apiKeyMetaQuery = useQuery(
    trpc.admin.machine.apiKey.getMetadata.queryOptions(
      { machineId: machineEditId ?? "" },
      { enabled: machineSheetOpen && !!machineEditId },
    ),
  );

  const openCreateVersion = () => {
    setVersionEdit(null);
    setVersionNumber("");
    setVersionDescription("");
    setVersionSheetOpen(true);
  };

  const openEditVersion = (row: VersionRow) => {
    setVersionEdit(row);
    setVersionNumber(row.versionNumber);
    setVersionDescription(row.description);
    setVersionSheetOpen(true);
  };

  const openCreateMachine = () => {
    setMachineEditId(null);
    setMachineVersionId(versionsQuery.data?.[0]?.id ?? "");
    setMachineInternalName("");
    setMachineComments("");
    setMachineDisabled(false);
    setApiKeySecret(null);
    setMachineSheetOpen(true);
  };

  const openEditMachine = (m: MachineListRow) => {
    setMachineEditId(m.id);
    setMachineVersionId(m.machineVersionId);
    setMachineInternalName(m.internalName);
    setMachineComments(m.comments);
    setMachineDisabled(m.disabled);
    setApiKeySecret(null);
    setMachineSheetOpen(true);
  };

  const invalidateApiKeyMeta = () => {
    if (!machineEditId) return;
    void queryClient.invalidateQueries(
      trpc.admin.machine.apiKey.getMetadata.queryFilter({
        machineId: machineEditId,
      }),
    );
  };

  const createApiKeyMutation = useMutation({
    ...trpc.admin.machine.apiKey.create.mutationOptions(),
    onSuccess: () => {
      invalidateApiKeyMeta();
      void machinesQuery.refetch();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const rotateApiKeyMutation = useMutation({
    ...trpc.admin.machine.apiKey.rotate.mutationOptions(),
    onSuccess: () => {
      invalidateApiKeyMeta();
      void machinesQuery.refetch();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const revokeApiKeyMutation = useMutation({
    ...trpc.admin.machine.apiKey.revoke.mutationOptions(),
    onSuccess: () => {
      invalidateApiKeyMeta();
      void machinesQuery.refetch();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const createVersionMutation = useMutation({
    ...trpc.admin.machineVersion.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Version created");
      void versionsQuery.refetch();
      setVersionSheetOpen(false);
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const updateVersionMutation = useMutation({
    ...trpc.admin.machineVersion.update.mutationOptions(),
    onSuccess: () => {
      toast.success("Version updated");
      void versionsQuery.refetch();
      setVersionSheetOpen(false);
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const deleteVersionMutation = useMutation({
    ...trpc.admin.machineVersion.delete.mutationOptions(),
    onSuccess: () => {
      toast.success("Version deleted");
      void versionsQuery.refetch();
      void machinesQuery.refetch();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const createMachineMutation = useMutation({
    ...trpc.admin.machine.create.mutationOptions(),
    onSuccess: (data) => {
      toast.success("Machine created");
      void machinesQuery.refetch();
      setMachineEditId(data.id);
      setMachineVersionId(data.machineVersionId);
      setMachineComments(data.comments);
      setMachineDisabled(data.disabled);
      setApiKeySecret(null);
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const updateMachineMutation = useMutation({
    ...trpc.admin.machine.update.mutationOptions(),
    onSuccess: () => {
      toast.success("Machine updated");
      void machinesQuery.refetch();
      setMachineSheetOpen(false);
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const deleteMachineMutation = useMutation({
    ...trpc.admin.machine.delete.mutationOptions(),
    onSuccess: () => {
      toast.success("Machine removed");
      void machinesQuery.refetch();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const submitVersion = (e: React.FormEvent) => {
    e.preventDefault();
    const num = versionNumber.trim();
    const desc = versionDescription.trim();
    if (!num || !desc) {
      toast.error("Version number and description are required.");
      return;
    }
    if (versionEdit) {
      updateVersionMutation.mutate({ id: versionEdit.id, description: desc });
    } else {
      createVersionMutation.mutate({
        versionNumber: num,
        description: desc,
      });
    }
  };

  const submitMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineVersionId) {
      toast.error("Select a machine version.");
      return;
    }
    const internalName = machineInternalName.trim();
    if (!internalName) {
      toast.error("Internal name is required.");
      return;
    }
    if (machineEditId) {
      updateMachineMutation.mutate({
        id: machineEditId,
        machineVersionId,
        internalName,
        comments: machineComments,
        disabled: machineDisabled,
      });
    } else {
      createMachineMutation.mutate({
        machineVersionId,
        internalName,
        comments: machineComments,
        disabled: machineDisabled,
      });
    }
  };

  const versions = versionsQuery.data ?? [];
  const versionSelectItems = useMemo(() => {
    const items: Record<string, ReactNode> = {};
    for (const v of versions) {
      items[v.id] = v.versionNumber;
    }
    return items;
  }, [versions]);
  const machines: MachineListRow[] = machinesQuery.data ?? [];
  const versionsLoading = versionsQuery.isPending;
  const machinesLoading = machinesQuery.isPending;

  const confirmDeleteVersion = (id: string, label: string) => {
    if (!confirm(`Delete version "${label}"? This cannot be undone.`)) return;
    deleteVersionMutation.mutate({ id });
  };

  const confirmDeleteMachine = (id: string) => {
    if (!confirm("Remove this machine? This cannot be undone.")) return;
    deleteMachineMutation.mutate({ id });
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-medium">Machines</h1>

      <div className="flex flex-col gap-8">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Machine versions</CardTitle>
              <CardDescription>
                Shared catalog of version numbers and descriptions. Machines
                reference one version each.
              </CardDescription>
            </div>
            <Button type="button" size="sm" onClick={openCreateVersion}>
              Add version
            </Button>
          </CardHeader>
          <CardContent>
            {versionsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No versions yet. Create a version before adding machines.
              </p>
            ) : (
              <div className="overflow-x-auto border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 font-medium">Version</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((v) => (
                      <tr key={v.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono">{v.versionNumber}</td>
                        <td
                          className="max-w-[240px] truncate px-3 py-2 text-muted-foreground"
                          title={v.description}
                        >
                          {v.description}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => openEditVersion(v)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            onClick={() =>
                              confirmDeleteVersion(v.id, v.versionNumber)
                            }
                            disabled={deleteVersionMutation.isPending}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Machines</CardTitle>
              <CardDescription>
                Physical or logical machines with comments and an assigned
                version.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={openCreateMachine}
              disabled={versions.length === 0}
            >
              Add machine
            </Button>
          </CardHeader>
          <CardContent>
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add at least one machine version above before creating machines.
              </p>
            ) : machinesLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : machines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No machines yet. Use &quot;Add machine&quot; to create one.
              </p>
            ) : (
              <div className="overflow-x-auto border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 font-medium">Device</th>
                      <th className="px-3 py-2 font-medium">Internal name</th>
                      <th className="px-3 py-2 font-medium">Version</th>
                      <th className="px-3 py-2 font-medium">Comments</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {machines.map((m) => (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to="/machines/$machineId"
                              params={{ machineId: m.id }}
                              className="underline-offset-2 hover:underline"
                              title="Open machine"
                            >
                              View
                            </Link>
                            <button
                              type="button"
                              className="text-muted-foreground underline-offset-2 hover:underline"
                              title="Copy device id (for API / hardware)"
                              onClick={async () => {
                                await navigator.clipboard.writeText(m.id);
                                toast.success("Device id copied");
                              }}
                            >
                              Copy id
                            </button>
                          </div>
                        </td>
                        <td className="max-w-[160px] px-3 py-2 font-medium leading-tight">
                          {m.internalName.trim() || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono">{m.versionNumber}</td>
                        <td
                          className="max-w-[200px] truncate px-3 py-2 text-muted-foreground"
                          title={m.comments}
                        >
                          {m.comments || "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {m.disabled ? (
                            <span className="text-destructive">Disabled</span>
                          ) : (
                            "Active"
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => openEditMachine(m)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            onClick={() => confirmDeleteMachine(m.id)}
                            disabled={deleteMachineMutation.isPending}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={versionSheetOpen} onOpenChange={setVersionSheetOpen}>
        <SheetContent
          side="right"
          className="max-h-dvh overflow-hidden sm:max-w-md"
        >
          <form
            className="flex h-full min-h-0 flex-col overflow-hidden"
            onSubmit={submitVersion}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
              <SheetHeader>
                <SheetTitle>
                  {versionEdit ? "Edit machine version" : "New machine version"}
                </SheetTitle>
                <SheetDescription>
                  {versionEdit
                    ? "Update the description. Version number cannot be changed."
                    : "Version numbers must be unique across the catalog."}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mv-number">Version number</Label>
                  <Input
                    id="mv-number"
                    value={versionNumber}
                    onChange={(e) => setVersionNumber(e.target.value)}
                    disabled={!!versionEdit}
                    placeholder="e.g. 2.1.0"
                    required={!versionEdit}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mv-desc">Description</Label>
                  <textarea
                    id="mv-desc"
                    className={textareaClassName}
                    value={versionDescription}
                    onChange={(e) => setVersionDescription(e.target.value)}
                    placeholder="What ships in this version"
                    required
                  />
                </div>
              </div>
            </div>
            <SheetFooter className="mt-0 shrink-0 border-t border-border bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVersionSheetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createVersionMutation.isPending ||
                  updateVersionMutation.isPending
                }
              >
                {versionEdit ? "Save" : "Create"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={machineSheetOpen} onOpenChange={setMachineSheetOpen}>
        <SheetContent
          side="right"
          className="max-h-dvh overflow-hidden sm:max-w-md"
        >
          <form
            className="flex h-full min-h-0 flex-col overflow-hidden"
            onSubmit={submitMachine}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
              <SheetHeader>
                <SheetTitle>
                  {machineEditId ? "Edit machine" : "New machine"}
                </SheetTitle>
                <SheetDescription>
                  Internal name for your team; comments are separate from
                  operator-facing names.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-internal">Internal name</Label>
                <Input
                  id="m-internal"
                  className="h-8 rounded-none text-xs"
                  value={machineInternalName}
                  onChange={(e) => setMachineInternalName(e.target.value)}
                  placeholder="e.g. Arena concourse west"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-version">Machine version</Label>
                <Select
                  items={versionSelectItems}
                  value={machineVersionId}
                  onValueChange={(v) => setMachineVersionId(v ?? "")}
                >
                  <SelectTrigger
                    id="m-version"
                    className="h-8 w-full rounded-none text-xs"
                  >
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="rounded-none">
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.versionNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-comments">Comments</Label>
                <textarea
                  id="m-comments"
                  className={textareaClassName}
                  value={machineComments}
                  onChange={(e) => setMachineComments(e.target.value)}
                  placeholder="Notes for operators or admins"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="m-disabled"
                  checked={machineDisabled}
                  onCheckedChange={(v) => setMachineDisabled(v === true)}
                />
                <Label htmlFor="m-disabled" className="font-normal">
                  Machine disabled (device cannot authenticate)
                </Label>
              </div>

              {machineEditId ? (
                <div className="border-t border-border pt-4">
                  <h3 className="mb-2 text-sm font-medium">Device API key</h3>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Send{" "}
                    <span className="font-mono text-foreground">
                      X-Machine-Key: &lt;key&gt;
                    </span>{" "}
                    and{" "}
                    <span className="font-mono text-foreground">
                      X-Machine-Id: {machineEditId}
                    </span>
                    .
                  </p>
                  {apiKeySecret ? (
                    <div
                      className="mb-3 rounded-none border border-amber-500/40 bg-amber-500/5 p-3"
                      role="region"
                      aria-label="New API key — copy now"
                    >
                      <p className="mb-2 text-xs font-medium text-amber-950 dark:text-amber-100">
                        Copy this key now. You won&apos;t see the full secret again
                        after you close this panel.
                      </p>
                      <Label
                        htmlFor="machine-api-key-once"
                        className="text-xs text-muted-foreground"
                      >
                        API key
                      </Label>
                      <textarea
                        id="machine-api-key-once"
                        readOnly
                        className={cn(textareaClassName, "mt-1 font-mono")}
                        value={apiKeySecret}
                        rows={4}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await navigator.clipboard.writeText(apiKeySecret);
                            toast.success("API key copied");
                          }}
                        >
                          Copy key
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setApiKeySecret(null)}
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {apiKeyMetaQuery.isPending ? (
                    <p className="text-xs text-muted-foreground">Loading key…</p>
                  ) : !apiKeyMetaQuery.data ? (
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={createApiKeyMutation.isPending}
                        onClick={() =>
                          createApiKeyMutation.mutate(
                            { machineId: machineEditId },
                            {
                              onSuccess: (d) => setApiKeySecret(d.key),
                            },
                          )
                        }
                      >
                        Generate API key
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 text-xs">
                      <p className="font-mono text-[11px]">
                        {(apiKeyMetaQuery.data.prefix ?? "SLUSH_") +
                          (apiKeyMetaQuery.data.start
                            ? `${apiKeyMetaQuery.data.start}***`
                            : "****")}
                      </p>
                      <p className="text-muted-foreground">
                        {apiKeyMetaQuery.data.enabled ? "Enabled" : "Disabled"} ·
                        updated {apiKeyMetaQuery.data.updatedAt.toLocaleString()}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={rotateApiKeyMutation.isPending}
                          onClick={() => {
                            if (
                              !confirm(
                                "Rotate this key? The old secret stops working immediately.",
                              )
                            ) {
                              return;
                            }
                            rotateApiKeyMutation.mutate(
                              { machineId: machineEditId },
                              {
                                onSuccess: (d) => setApiKeySecret(d.key),
                              },
                            );
                          }}
                        >
                          Rotate key
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={revokeApiKeyMutation.isPending}
                          onClick={() => {
                            if (
                              !confirm(
                                "Revoke this key? Devices using it will stop authenticating.",
                              )
                            ) {
                              return;
                            }
                            revokeApiKeyMutation.mutate({ machineId: machineEditId });
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Save the machine to generate a device API key.
                </p>
              )}
              </div>
            </div>
            <SheetFooter className="mt-0 shrink-0 border-t border-border bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMachineSheetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createMachineMutation.isPending ||
                  updateMachineMutation.isPending
                }
              >
                {machineEditId ? "Save" : "Create"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
