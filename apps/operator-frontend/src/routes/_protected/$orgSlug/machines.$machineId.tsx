import { Button, buttonVariants } from "@slushomat/ui/base/button";
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
import { Label } from "@slushomat/ui/base/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@slushomat/ui/lib/utils";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute(
  "/_protected/$orgSlug/machines/$machineId",
)({
  component: OperatorMachineDetailPage,
});

type SlotsState = {
  left: string | null;
  middle: string | null;
  right: string | null;
};

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

function isNoOpenDeploymentError(e: unknown): boolean {
  return errMessage(e).includes("No open deployment");
}

function OperatorMachineDetailPage() {
  const { orgSlug, machineId } = Route.useParams();
  const queryClient = useQueryClient();

  const [slotsDraft, setSlotsDraft] = useState<SlotsState | null>(null);

  const machineQuery = useQuery({
    ...trpc.operator.machine.get.queryOptions({ orgSlug, machineId }),
    retry: false,
  });

  const productsQuery = useQuery(
    trpc.operator.product.list.queryOptions({ orgSlug }),
  );

  const configQuery = useQuery({
    ...trpc.operator.machineSlot.getConfigForMachine.queryOptions({
      orgSlug,
      machineId,
    }),
    enabled: machineQuery.isSuccess,
    retry: false,
  });

  useEffect(() => {
    if (configQuery.data) {
      setSlotsDraft({ ...configQuery.data.slots });
    }
  }, [configQuery.data]);

  const setSlotsMutation = useMutation({
    ...trpc.operator.machineSlot.setSlots.mutationOptions(),
    onSuccess: () => {
      toast.success("Slot configuration saved");
      void queryClient.invalidateQueries(
        trpc.operator.machineSlot.getConfigForMachine.queryFilter({
          orgSlug,
          machineId,
        }),
      );
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const handleSave = () => {
    if (!slotsDraft) {
      toast.error("Slot configuration is still loading");
      return;
    }
    setSlotsMutation.mutate({
      orgSlug,
      machineId,
      slots: slotsDraft,
    });
  };

  const products = productsQuery.data ?? [];

  const showNoDeployment =
    machineQuery.isSuccess &&
    configQuery.isError &&
    isNoOpenDeploymentError(configQuery.error);

  const showOtherSlotError =
    machineQuery.isSuccess &&
    configQuery.isError &&
    !showNoDeployment;

  const showConfig =
    machineQuery.isSuccess &&
    configQuery.isSuccess &&
    slotsDraft &&
    !configQuery.isFetching;

  if (machineQuery.isPending) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading machine…</p>
      </div>
    );
  }

  if (machineQuery.isError) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Empty className="rounded-none border">
          <EmptyHeader>
            <EmptyTitle>Machine unavailable</EmptyTitle>
            <EmptyDescription>
              {errMessage(machineQuery.error)}. It may not belong to this
              organization.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
        <Link
          to="/$orgSlug/machines"
          params={{ orgSlug }}
          className={cn(buttonVariants({ variant: "outline" }), "mt-6 inline-flex")}
        >
          Back to machines
        </Link>
      </div>
    );
  }

  const m = machineQuery.data;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link
          to="/$orgSlug/machines"
          params={{ orgSlug }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 mb-2 inline-flex px-2",
          )}
        >
          ← Machines
        </Link>
        <h1 className="font-mono text-lg font-medium tracking-tight">
          {m.id}
        </h1>
        <p className="text-sm text-muted-foreground">
          Model {m.versionNumber}
          {m.disabled ? " · disabled" : ""}
        </p>
        <Link
          to="/$orgSlug/machines/$machineId/purchases"
          params={{ orgSlug, machineId }}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "mt-3 inline-flex",
          )}
        >
          View purchases
        </Link>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        Assign your organization&apos;s products to the left, middle, and right
        dispenser slots. Saving requires an{" "}
        <span className="font-medium text-foreground">open deployment</span> for
        this machine.
      </p>

      {configQuery.isFetching && machineQuery.isSuccess ? (
        <p className="text-sm text-muted-foreground">Loading slot config…</p>
      ) : null}

      {showOtherSlotError ? (
        <Card className="mb-6 rounded-none border border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Could not load slot configuration
            </CardTitle>
            <CardDescription>
              {errMessage(configQuery.error)}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {showNoDeployment ? (
        <Empty className="rounded-none border">
          <EmptyHeader>
            <EmptyTitle>No open deployment</EmptyTitle>
            <EmptyDescription>
              This machine has no active deployment linked to a business entity
              in your organization. Ask an admin to start a deployment before
              you can configure slots.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {showConfig ? (
        <Card className="rounded-none border">
          <CardHeader>
            <CardTitle className="text-base">Dispenser slots</CardTitle>
            <CardDescription>
              Deployment{" "}
              <span className="font-mono text-xs">
                {configQuery.data.deploymentId.slice(0, 8)}…
              </span>
              — choose a product per slot or leave empty.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {(
              [
                ["left", "Left"],
                ["middle", "Middle"],
                ["right", "Right"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="grid gap-1.5">
                <Label>{label}</Label>
                <select
                  className="h-9 w-full rounded-none border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                  value={slotsDraft[key] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSlotsDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            [key]: v === "" ? null : v,
                          }
                        : prev,
                    );
                  }}
                >
                  <option value="">— Empty —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <Button
              type="button"
              className="w-fit rounded-none"
              onClick={handleSave}
              disabled={setSlotsMutation.isPending || products.length === 0}
            >
              {setSlotsMutation.isPending ? "Saving…" : "Save slots"}
            </Button>
            {products.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add products under Products before assigning slots.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
