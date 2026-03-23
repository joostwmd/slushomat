import { Download, Receipt } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@slushomat/ui/base/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@slushomat/ui/base/empty";
import { Input } from "@slushomat/ui/base/input";
import { Label } from "@slushomat/ui/base/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@slushomat/ui/base/select";
import { Skeleton } from "@slushomat/ui/base/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@slushomat/ui/base/table";
import { cn } from "@slushomat/ui/lib/utils";

export interface PurchaseRow {
  id: string;
  purchasedAt: Date;
  machineId: string;
  /** Human-facing machine label when available (org name, etc.). */
  machineLabel?: string;
  slot: "left" | "middle" | "right";
  productName: string;
  amountInCents: number;
  businessEntityName?: string | null;
}

export interface PurchaseFilterOption {
  id: string;
  label: string;
}

export interface PurchasesTableProps {
  data: PurchaseRow[];
  isLoading: boolean;
  filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    businessEntityId?: string;
    machineId?: string;
  };
  onFiltersChange?: (filters: NonNullable<PurchasesTableProps["filters"]>) => void;
  onExportCsv?: () => void;
  showMachineColumn?: boolean;
  showEntityColumn?: boolean;
  /** Options for entity filter dropdown */
  entityOptions?: PurchaseFilterOption[];
  /** Options for machine filter dropdown */
  machineOptions?: PurchaseFilterOption[];
}

const slotLabel: Record<PurchaseRow["slot"], string> = {
  left: "Left",
  middle: "Middle",
  right: "Right",
};

function formatDateTimeDe(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatEur(amountInCents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amountInCents / 100);
}

const FILTER_ALL = "__all__";

function buildSelectItems(
  sentinel: string,
  sentinelLabel: string,
  options: PurchaseFilterOption[],
): Record<string, string> {
  const items: Record<string, string> = { [sentinel]: sentinelLabel };
  for (const o of options) {
    items[o.id] = o.label;
  }
  return items;
}

function toDateInputValue(d: Date | undefined): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateInput(s: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function PurchasesTable({
  data,
  isLoading,
  filters,
  onFiltersChange,
  onExportCsv,
  showMachineColumn = true,
  showEntityColumn = true,
  entityOptions = [],
  machineOptions = [],
}: PurchasesTableProps) {
  const hasActiveFilter = Boolean(
    filters?.dateFrom ||
      filters?.dateTo ||
      filters?.businessEntityId ||
      filters?.machineId,
  );

  const setFilters = (patch: Partial<NonNullable<PurchasesTableProps["filters"]>>) => {
    onFiltersChange?.({ ...(filters ?? {}), ...patch });
  };

  const entitySelectItems = useMemo(
    () => buildSelectItems(FILTER_ALL, "All entities", entityOptions),
    [entityOptions],
  );

  const machineSelectItems = useMemo(
    () => buildSelectItems(FILTER_ALL, "All machines", machineOptions),
    [machineOptions],
  );

  const showToolbar = Boolean(onFiltersChange || onExportCsv);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {showToolbar ? (
        <div className="flex flex-wrap items-end gap-3 border border-border bg-muted/10 p-3">
          {onFiltersChange ? (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">From</Label>
                <Input
                  type="date"
                  className="h-8 w-[9.5rem] text-xs"
                  value={toDateInputValue(filters?.dateFrom)}
                  onChange={(e) =>
                    setFilters({ dateFrom: parseDateInput(e.target.value) })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">To</Label>
                <Input
                  type="date"
                  className="h-8 w-[9.5rem] text-xs"
                  value={toDateInputValue(filters?.dateTo)}
                  onChange={(e) =>
                    setFilters({ dateTo: parseDateInput(e.target.value) })
                  }
                />
              </div>
              {showEntityColumn && entityOptions.length > 0 ? (
                <div className="flex min-w-[10rem] flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Entity
                  </Label>
                  <Select
                    items={entitySelectItems}
                    value={
                      filters?.businessEntityId &&
                      filters.businessEntityId !== ""
                        ? filters.businessEntityId
                        : FILTER_ALL
                    }
                    onValueChange={(v) =>
                      setFilters({
                        businessEntityId:
                          v === FILTER_ALL || v == null ? undefined : v,
                      })
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        "h-8 border border-border bg-background text-xs",
                        "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
                      )}
                    >
                      <SelectValue placeholder="All entities" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="rounded-none">
                      <SelectItem value={FILTER_ALL}>All entities</SelectItem>
                      {entityOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {showMachineColumn && machineOptions.length > 0 ? (
                <div className="flex min-w-[10rem] flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Machine
                  </Label>
                  <Select
                    items={machineSelectItems}
                    value={
                      filters?.machineId && filters.machineId !== ""
                        ? filters.machineId
                        : FILTER_ALL
                    }
                    onValueChange={(v) =>
                      setFilters({
                        machineId:
                          v === FILTER_ALL || v == null ? undefined : v,
                      })
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        "h-8 border border-border bg-background text-xs",
                        "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
                      )}
                    >
                      <SelectValue placeholder="All machines" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="rounded-none">
                      <SelectItem value={FILTER_ALL}>All machines</SelectItem>
                      {machineOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </>
          ) : null}
          {onExportCsv ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("gap-1.5", onFiltersChange && "ml-auto")}
              onClick={onExportCsv}
            >
              <Download className="size-3.5" aria-hidden />
              Export CSV
            </Button>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-2 border border-border p-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Receipt className="size-4" />
            </EmptyMedia>
            <EmptyTitle>
              {hasActiveFilter
                ? "No results for this filter"
                : "No purchases yet"}
            </EmptyTitle>
            <EmptyDescription>
              {hasActiveFilter
                ? "Try widening the date range."
                : "Sales from connected machines will show up here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date / time</TableHead>
              {showMachineColumn ? <TableHead>Machine</TableHead> : null}
              <TableHead>Slot</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Amount</TableHead>
              {showEntityColumn ? <TableHead>Business entity</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="tabular-nums">
                  {formatDateTimeDe(
                    row.purchasedAt instanceof Date
                      ? row.purchasedAt
                      : new Date(row.purchasedAt),
                  )}
                </TableCell>
                {showMachineColumn ? (
                  <TableCell>
                    <span className="text-sm">
                      {row.machineLabel?.trim() || "—"}
                    </span>
                  </TableCell>
                ) : null}
                <TableCell>{slotLabel[row.slot]}</TableCell>
                <TableCell className="max-w-[12rem] truncate font-medium">
                  {row.productName}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatEur(row.amountInCents)}
                </TableCell>
                {showEntityColumn ? (
                  <TableCell className="max-w-[10rem] truncate text-muted-foreground">
                    {row.businessEntityName ?? "—"}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
