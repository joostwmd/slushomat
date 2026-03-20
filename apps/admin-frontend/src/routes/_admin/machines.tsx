import { Button } from "@slushomat/ui/base/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@slushomat/ui/base/sheet";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@slushomat/ui/lib/utils";
import { useState } from "react";
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

function MachinesPage() {
  const versionsQuery = useQuery(trpc.admin.machineVersion.list.queryOptions());
  const machinesQuery = useQuery(trpc.admin.machine.list.queryOptions());

  const [versionSheetOpen, setVersionSheetOpen] = useState(false);
  const [versionEdit, setVersionEdit] = useState<VersionRow | null>(null);
  const [versionNumber, setVersionNumber] = useState("");
  const [versionDescription, setVersionDescription] = useState("");

  const [machineSheetOpen, setMachineSheetOpen] = useState(false);
  const [machineEditId, setMachineEditId] = useState<string | null>(null);
  const [machineVersionId, setMachineVersionId] = useState("");
  const [machineComments, setMachineComments] = useState("");

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
    setMachineComments("");
    setMachineSheetOpen(true);
  };

  const openEditMachine = (m: {
    id: string;
    machineVersionId: string;
    comments: string;
  }) => {
    setMachineEditId(m.id);
    setMachineVersionId(m.machineVersionId);
    setMachineComments(m.comments);
    setMachineSheetOpen(true);
  };

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
    onSuccess: () => {
      toast.success("Machine created");
      void machinesQuery.refetch();
      setMachineSheetOpen(false);
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
    if (machineEditId) {
      updateMachineMutation.mutate({
        id: machineEditId,
        machineVersionId,
        comments: machineComments,
      });
    } else {
      createMachineMutation.mutate({
        machineVersionId,
        comments: machineComments,
      });
    }
  };

  const versions = versionsQuery.data ?? [];
  const machines = machinesQuery.data ?? [];
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
                      <th className="px-3 py-2 font-medium">Id</th>
                      <th className="px-3 py-2 font-medium">Version</th>
                      <th className="px-3 py-2 font-medium">Comments</th>
                      <th className="px-3 py-2 font-medium text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {machines.map((m) => (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono text-[11px]">
                          <button
                            type="button"
                            className="underline-offset-2 hover:underline"
                            title="Copy full id"
                            onClick={async () => {
                              await navigator.clipboard.writeText(m.id);
                              toast.success("Id copied");
                            }}
                          >
                            {m.id.slice(0, 8)}…
                          </button>
                        </td>
                        <td className="px-3 py-2 font-mono">{m.versionNumber}</td>
                        <td
                          className="max-w-[200px] truncate px-3 py-2 text-muted-foreground"
                          title={m.comments}
                        >
                          {m.comments || "—"}
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
        <SheetContent side="right" className="sm:max-w-md">
          <form onSubmit={submitVersion}>
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
            <div className="flex flex-col gap-4 px-4">
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
            <SheetFooter className="mt-6">
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
        <SheetContent side="right" className="sm:max-w-md">
          <form onSubmit={submitMachine}>
            <SheetHeader>
              <SheetTitle>
                {machineEditId ? "Edit machine" : "New machine"}
              </SheetTitle>
              <SheetDescription>
                Assign a catalog version and optional comments.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="m-version">Machine version</Label>
                <select
                  id="m-version"
                  className={cn(
                    "h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30",
                  )}
                  value={machineVersionId}
                  onChange={(e) => setMachineVersionId(e.target.value)}
                  required
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.versionNumber}
                    </option>
                  ))}
                </select>
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
            </div>
            <SheetFooter className="mt-6">
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
