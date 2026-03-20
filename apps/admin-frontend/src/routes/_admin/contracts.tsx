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
import { createSupabaseBrowserClient } from "@slushomat/supabase";
import { env } from "@slushomat/env/web";
import { cn } from "@slushomat/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_admin/contracts")({
  component: AdminContractsPage,
});

const PDF_MAX = 10 * 1024 * 1024;

const textareaClassName = cn(
  "flex min-h-[72px] w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1.5 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 md:text-xs dark:bg-input/30",
);

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

function eurosToCents(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(",", ".").trim());
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

function percentToBp(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(",", ".").trim());
  if (Number.isNaN(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100);
}

function bpToPercent(bp: number): string {
  return (bp / 100).toFixed(2);
}

type ContractRow = {
  id: string;
  organizationId: string;
  businessEntityId: string;
  machineId: string;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: "draft" | "active" | "terminated";
  effectiveDate: Date;
  endedAt: Date | null;
  monthlyRentInCents: number;
  revenueShareBasisPoints: number;
  pdfBucket: string | null;
  pdfObjectPath: string | null;
  notes: string | null;
};

function AdminContractsPage() {
  const queryClient = useQueryClient();
  const orgsQuery = useQuery(trpc.admin.listOrganizations.queryOptions());
  const machinesQuery = useQuery(trpc.admin.machine.list.queryOptions());

  const [filterOrg, setFilterOrg] = useState("");
  const [filterMachine, setFilterMachine] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "" | "draft" | "active" | "terminated"
  >("");

  const listQuery = useQuery({
    ...trpc.admin.operatorContract.list.queryOptions({
      organizationId: filterOrg || undefined,
      machineId: filterMachine || undefined,
      businessEntityId: filterEntity || undefined,
      status: filterStatus || undefined,
    }),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createOrg, setCreateOrg] = useState("");
  const [createEntity, setCreateEntity] = useState("");
  const [createMachine, setCreateMachine] = useState("");
  const [cStatus, setCStatus] = useState<"draft" | "active" | "terminated">(
    "draft",
  );
  const [cEffective, setCEffective] = useState("");
  const [cEnded, setCEnded] = useState("");
  const [cRent, setCRent] = useState("");
  const [cShare, setCShare] = useState("15");
  const [cNotes, setCNotes] = useState("");
  const [cPdf, setCPdf] = useState<File | null>(null);

  const createEntitiesQuery = useQuery({
    ...trpc.admin.businessEntity.listByOrganization.queryOptions({
      organizationId: createOrg,
    }),
    enabled: !!createOrg && createOpen,
  });

  const [detailId, setDetailId] = useState<string | null>(null);
  const detailQuery = useQuery({
    ...trpc.admin.operatorContract.get.queryOptions({ id: detailId ?? "" }),
    enabled: !!detailId,
  });

  const [versionOpen, setVersionOpen] = useState(false);
  const [vStatus, setVStatus] = useState<"draft" | "active" | "terminated">(
    "draft",
  );
  const [vEffective, setVEffective] = useState("");
  const [vEnded, setVEnded] = useState("");
  const [vRent, setVRent] = useState("");
  const [vShare, setVShare] = useState("");
  const [vNotes, setVNotes] = useState("");

  const invalidateList = () => {
    void queryClient.invalidateQueries(
      trpc.admin.operatorContract.list.queryFilter(),
    );
  };

  const createMutation = useMutation({
    ...trpc.admin.operatorContract.create.mutationOptions(),
    onSuccess: async (data: { contractId: string; versionId: string }) => {
      toast.success("Contract created");
      invalidateList();
      setCreateOpen(false);
      if (cPdf && createOrg) {
        try {
          await uploadPdf(
            data.contractId,
            data.versionId,
            createOrg,
            cPdf,
          );
          toast.success("PDF uploaded");
        } catch (e) {
          toast.error(errMessage(e));
        }
      }
      setCPdf(null);
      setDetailId(data.contractId);
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const addVersionMutation = useMutation({
    ...trpc.admin.operatorContract.addVersion.mutationOptions(),
    onSuccess: async (data) => {
      toast.success("New version saved");
      invalidateList();
      if (detailId) {
        void detailQuery.refetch();
      }
      setVersionOpen(false);
      if (pendingPdf && detailOrgId) {
        try {
          await uploadPdf(detailId!, data.versionId, detailOrgId, pendingPdf);
          toast.success("PDF uploaded");
        } catch (e) {
          toast.error(errMessage(e));
        }
        setPendingPdf(null);
      }
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const requestPdfMutation = useMutation(
    trpc.admin.operatorContract.requestPdfUpload.mutationOptions(),
  );
  const confirmPdfMutation = useMutation(
    trpc.admin.operatorContract.confirmPdf.mutationOptions(),
  );

  const [pendingPdf, setPendingPdf] = useState<File | null>(null);

  const detailOrgId = detailQuery.data?.contract.organizationId ?? "";

  async function uploadPdf(
    contractId: string,
    versionId: string,
    organizationId: string,
    file: File,
  ) {
    if (file.size > PDF_MAX) throw new Error("PDF max 10 MB");
    if (file.type !== "application/pdf") throw new Error("PDF only");
    const signed = await requestPdfMutation.mutateAsync({
      contractId,
      versionId,
      organizationId,
      contentType: "application/pdf",
      fileSizeBytes: file.size,
    });
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const anon = env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anon) {
      throw new Error("Supabase env missing for upload");
    }
    const client = createSupabaseBrowserClient(supabaseUrl, anon);
    const { error } = await client.storage
      .from(signed.bucket)
      .uploadToSignedUrl(signed.path, signed.token, file, {
        contentType: "application/pdf",
      });
    if (error) throw new Error(error.message);
    await confirmPdfMutation.mutateAsync({
      contractId,
      versionId,
      organizationId,
      objectPath: signed.path,
    });
  }

  const openCreate = () => {
    setCreateOrg(filterOrg || "");
    setCreateEntity("");
    setCreateMachine("");
    setCStatus("draft");
    setCEffective(toDateInput(new Date()));
    setCEnded("");
    setCRent("");
    setCShare("15");
    setCNotes("");
    setCPdf(null);
    setCreateOpen(true);
  };

  const submitCreate = () => {
    if (!createOrg || !createEntity || !createMachine) {
      toast.error("Organization, business, and machine are required");
      return;
    }
    const rent = eurosToCents(cRent);
    const bp = percentToBp(cShare);
    if (rent === null) {
      toast.error("Invalid monthly rent");
      return;
    }
    if (bp === null) {
      toast.error("Revenue share must be 0–100%");
      return;
    }
    if (!cEffective) {
      toast.error("Effective date required");
      return;
    }
    createMutation.mutate({
      organizationId: createOrg,
      businessEntityId: createEntity,
      machineId: createMachine,
      version: {
        status: cStatus,
        effectiveDate: new Date(cEffective),
        endedAt: cEnded ? new Date(cEnded) : null,
        monthlyRentInCents: rent,
        revenueShareBasisPoints: bp,
        notes: cNotes.trim() || null,
      },
    });
  };

  const openVersionDialog = (
    preset: Partial<{
      status: "draft" | "active" | "terminated";
    }>,
  ) => {
    const cur = detailQuery.data?.versions[0];
    if (!cur) return;
    setVStatus(preset.status ?? cur.status);
    setVEffective(toDateInput(cur.effectiveDate));
    setVEnded(cur.endedAt ? toDateInput(cur.endedAt) : "");
    setVRent((cur.monthlyRentInCents / 100).toFixed(2));
    setVShare(bpToPercent(cur.revenueShareBasisPoints));
    setVNotes(cur.notes ?? "");
    setPendingPdf(null);
    setVersionOpen(true);
  };

  const submitVersion = () => {
    if (!detailId || !detailOrgId) return;
    const rent = eurosToCents(vRent);
    const bp = percentToBp(vShare);
    if (rent === null || bp === null) {
      toast.error("Check rent and revenue share %");
      return;
    }
    if (!vEffective) {
      toast.error("Effective date required");
      return;
    }
    addVersionMutation.mutate({
      contractId: detailId,
      organizationId: detailOrgId,
      version: {
        status: vStatus,
        effectiveDate: new Date(vEffective),
        endedAt: vEnded ? new Date(vEnded) : null,
        monthlyRentInCents: rent,
        revenueShareBasisPoints: bp,
        notes: vNotes.trim() || null,
      },
    });
  };

  const rows: ContractRow[] = (listQuery.data ?? []) as ContractRow[];

  const createEntities = useMemo(
    () =>
      (createEntitiesQuery.data ?? []).filter((e) => !e.deletedAt),
    [createEntitiesQuery.data],
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Contracts</h1>
          <p className="text-sm text-muted-foreground">
            Operator contracts (versioned). Only one <strong>active</strong>{" "}
            contract per machine.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-none"
          onClick={openCreate}
        >
          New contract
        </Button>
      </div>

      <Card className="mb-6 rounded-none border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label>Organization</Label>
            <select
              className="h-8 rounded-none border border-input bg-transparent px-2 text-xs dark:bg-input/30"
              value={filterOrg}
              onChange={(e) => setFilterOrg(e.target.value)}
            >
              <option value="">All</option>
              {(orgsQuery.data ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label>Machine ID</Label>
            <Input
              className="h-8 rounded-none text-xs"
              value={filterMachine}
              onChange={(e) => setFilterMachine(e.target.value)}
              placeholder="contains…"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Business entity ID</Label>
            <Input
              className="h-8 rounded-none text-xs"
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              placeholder="contains…"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <select
              className="h-8 rounded-none border border-input bg-transparent px-2 text-xs dark:bg-input/30"
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as typeof filterStatus)
              }
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-none border">
        <CardHeader>
          <CardTitle className="text-base">Results</CardTitle>
          <CardDescription>{rows.length} contracts</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contracts.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Machine</th>
                  <th className="py-2 pr-2">Rent (€)</th>
                  <th className="py-2 pr-2">Share</th>
                  <th className="py-2 pr-2">Effective</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2 pr-2 capitalize">{r.status}</td>
                    <td className="py-2 pr-2 font-mono">{r.machineId.slice(0, 10)}…</td>
                    <td className="py-2 pr-2">
                      {(r.monthlyRentInCents / 100).toFixed(2)}
                    </td>
                    <td className="py-2 pr-2">
                      {bpToPercent(r.revenueShareBasisPoints)}%
                    </td>
                    <td className="py-2 pr-2 text-muted-foreground">
                      {r.effectiveDate.toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-none text-xs"
                        onClick={() => setDetailId(r.id)}
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Create */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="flex w-full max-w-lg flex-col overflow-y-auto rounded-none sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>New contract</SheetTitle>
            <SheetDescription>
              Initial version. Optional PDF after save.
            </SheetDescription>
          </SheetHeader>
          <div className="grid flex-1 gap-3 px-4 pb-4">
            <div className="grid gap-1.5">
              <Label>Organization</Label>
              <select
                className="h-8 rounded-none border border-input bg-transparent px-2 text-xs"
                value={createOrg}
                onChange={(e) => {
                  setCreateOrg(e.target.value);
                  setCreateEntity("");
                }}
              >
                <option value="">—</option>
                {(orgsQuery.data ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Business entity</Label>
              <select
                className="h-8 rounded-none border border-input bg-transparent px-2 text-xs"
                value={createEntity}
                onChange={(e) => setCreateEntity(e.target.value)}
                disabled={!createOrg}
              >
                <option value="">—</option>
                {createEntities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Machine</Label>
              <select
                className="h-8 rounded-none border border-input bg-transparent px-2 text-xs"
                value={createMachine}
                onChange={(e) => setCreateMachine(e.target.value)}
              >
                <option value="">—</option>
                {(machinesQuery.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id.slice(0, 8)}… v{m.versionNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <select
                className="h-8 rounded-none border border-input bg-transparent px-2 text-xs"
                value={cStatus}
                onChange={(e) =>
                  setCStatus(e.target.value as typeof cStatus)
                }
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <div>
                <Label>Effective</Label>
                <Input
                  type="date"
                  className="h-8 rounded-none text-xs"
                  value={cEffective}
                  onChange={(e) => setCEffective(e.target.value)}
                />
              </div>
              <div>
                <Label>Ended (optional)</Label>
                <Input
                  type="date"
                  className="h-8 rounded-none text-xs"
                  value={cEnded}
                  onChange={(e) => setCEnded(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <div>
                <Label>Monthly rent (€)</Label>
                <Input
                  className="h-8 rounded-none text-xs"
                  value={cRent}
                  onChange={(e) => setCRent(e.target.value)}
                />
              </div>
              <div>
                <Label>Revenue share (%)</Label>
                <Input
                  className="h-8 rounded-none text-xs"
                  value={cShare}
                  onChange={(e) => setCShare(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <textarea
                className={textareaClassName}
                value={cNotes}
                onChange={(e) => setCNotes(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>PDF (optional)</Label>
              <Input
                type="file"
                accept="application/pdf"
                className="text-xs"
                onChange={(e) => setCPdf(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <SheetFooter className="border-t">
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-none"
              disabled={createMutation.isPending}
              onClick={submitCreate}
            >
              Create
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Detail */}
      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="flex w-full max-w-xl flex-col overflow-y-auto rounded-none sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Contract</SheetTitle>
            <SheetDescription className="font-mono text-xs">
              {detailId}
            </SheetDescription>
          </SheetHeader>
          {detailQuery.data ? (
            <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-none text-xs"
                  variant="outline"
                  onClick={() => openVersionDialog({ status: "active" })}
                >
                  Activate (new version)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-none text-xs"
                  variant="outline"
                  onClick={() => openVersionDialog({ status: "terminated" })}
                >
                  Terminate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-none text-xs"
                  variant="secondary"
                  onClick={() => openVersionDialog({})}
                >
                  New version
                </Button>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">Versions</h3>
                <ul className="space-y-2 text-xs">
                  {detailQuery.data.versions.map((v) => (
                    <li
                      key={v.id}
                      className="border border-border p-2 rounded-none"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium capitalize">
                          v{v.versionNumber} · {v.status}
                        </span>
                        {v.pdfObjectPath ? (
                          <span className="text-muted-foreground">PDF ✓</span>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground">
                        Effective {v.effectiveDate.toLocaleDateString()}
                      </p>
                      <div className="mt-2">
                        <Label className="text-[10px]">Replace PDF</Label>
                        <Input
                          type="file"
                          accept="application/pdf"
                          className="mt-1 h-8 text-[10px]"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f || !detailId || !detailOrgId) return;
                            try {
                              await uploadPdf(detailId, v.id, detailOrgId, f);
                              toast.success("PDF updated");
                              void detailQuery.refetch();
                            } catch (err) {
                              toast.error(errMessage(err));
                            }
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </SheetContent>
      </Sheet>

      {/* Version dialog */}
      <Sheet open={versionOpen} onOpenChange={setVersionOpen}>
        <SheetContent className="flex w-full max-w-md flex-col rounded-none">
          <SheetHeader>
            <SheetTitle>New contract version</SheetTitle>
            <SheetDescription>
              Creates a new row and sets it current. Server rejects a second{" "}
              <strong>active</strong> contract on the same machine.
            </SheetDescription>
          </SheetHeader>
          <div className="grid flex-1 gap-3 px-4">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <select
                className="h-8 rounded-none border px-2 text-xs"
                value={vStatus}
                onChange={(e) =>
                  setVStatus(e.target.value as typeof vStatus)
                }
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <div>
                <Label>Effective</Label>
                <Input
                  type="date"
                  className="h-8 rounded-none text-xs"
                  value={vEffective}
                  onChange={(e) => setVEffective(e.target.value)}
                />
              </div>
              <div>
                <Label>Ended</Label>
                <Input
                  type="date"
                  className="h-8 rounded-none text-xs"
                  value={vEnded}
                  onChange={(e) => setVEnded(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <div>
                <Label>Rent €</Label>
                <Input
                  className="h-8 text-xs"
                  value={vRent}
                  onChange={(e) => setVRent(e.target.value)}
                />
              </div>
              <div>
                <Label>Share %</Label>
                <Input
                  className="h-8 text-xs"
                  value={vShare}
                  onChange={(e) => setVShare(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <textarea
                className={textareaClassName}
                value={vNotes}
                onChange={(e) => setVNotes(e.target.value)}
              />
            </div>
            <div>
              <Label>PDF (optional, this version)</Label>
              <Input
                type="file"
                accept="application/pdf"
                className="text-xs"
                onChange={(e) => setPendingPdf(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <SheetFooter className="border-t">
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => setVersionOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-none"
              disabled={addVersionMutation.isPending}
              onClick={submitVersion}
            >
              Save version
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function toDateInput(d: Date): string {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
