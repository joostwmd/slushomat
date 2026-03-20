import { Button } from "@slushomat/ui/base/button";
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
  EmptyTitle,
} from "@slushomat/ui/base/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@slushomat/ui/base/sheet";
import { Input } from "@slushomat/ui/base/input";
import { Label } from "@slushomat/ui/base/label";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/$orgSlug/contracts")({
  component: OperatorContractsPage,
});

function bpToPercent(bp: number): string {
  return (bp / 100).toFixed(2);
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

function OperatorContractsPage() {
  const { orgSlug } = Route.useParams();
  const [machineFilter, setMachineFilter] = useState("");

  const listQuery = useQuery(
    trpc.operator.operatorContract.list.queryOptions({
      orgSlug,
      machineId: machineFilter.trim() || undefined,
    }),
  );

  const [detailId, setDetailId] = useState<string | null>(null);
  const detailQuery = useQuery({
    ...trpc.operator.operatorContract.get.queryOptions({
      orgSlug,
      id: detailId ?? "",
    }),
    enabled: !!detailId,
  });

  const rows = listQuery.data ?? [];

  const openPdf = async (contractId: string, versionId: string) => {
    try {
      const { url } =
        await trpcClient.operator.operatorContract.getPdfDownloadUrl.query({
          orgSlug,
          contractId,
          versionId,
        });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(errMessage(e));
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-xl font-medium">Contracts</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Read-only. All statuses including terminated. PDF opens in a new tab
        when uploaded.
      </p>

      <Card className="mb-6 rounded-none border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-md gap-1.5">
            <Label>Machine ID (optional exact match)</Label>
            <Input
              className="h-8 rounded-none text-xs"
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
              placeholder="Leave empty for all contracts in this org"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-none border">
        <CardHeader>
          <CardTitle className="text-base">Your contracts</CardTitle>
          <CardDescription>{rows.length} found</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !listQuery.isLoading ? (
            <Empty className="border border-dashed py-8">
              <EmptyHeader>
                <EmptyTitle>No contract on file</EmptyTitle>
                <EmptyDescription>
                  That&apos;s OK — your admin may add one later.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <p className="font-medium capitalize">{r.status}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Machine {r.machineId.slice(0, 12)}…
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Rent €{(r.monthlyRentInCents / 100).toFixed(2)} · Share{" "}
                      {bpToPercent(r.revenueShareBasisPoints)}%
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-none text-xs"
                    onClick={() => setDetailId(r.id)}
                  >
                    Details
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="flex w-full max-w-lg flex-col overflow-y-auto rounded-none">
          <SheetHeader>
            <SheetTitle>Contract detail</SheetTitle>
            <SheetDescription className="font-mono text-xs break-all">
              {detailId}
            </SheetDescription>
          </SheetHeader>
          {detailQuery.data ? (
            <div className="flex flex-col gap-4 px-4 pb-6">
              <div>
                <h3 className="mb-2 text-sm font-medium">Versions</h3>
                <ul className="space-y-3 text-xs">
                  {detailQuery.data.versions.map((v) => (
                    <li
                      key={v.id}
                      className="border border-border p-3 rounded-none"
                    >
                      <p className="font-medium capitalize">
                        v{v.versionNumber} · {v.status}
                      </p>
                      <p className="text-muted-foreground">
                        Effective {v.effectiveDate.toLocaleDateString()}
                      </p>
                      {v.pdfObjectPath ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="mt-2 rounded-none text-xs"
                          onClick={() =>
                            void openPdf(detailId!, v.id)
                          }
                        >
                          Open PDF
                        </Button>
                      ) : (
                        <p className="mt-1 text-muted-foreground">No PDF</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground px-4">Loading…</p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
