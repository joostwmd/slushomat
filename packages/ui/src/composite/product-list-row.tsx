import * as React from "react";

import { cn } from "@slushomat/ui/lib/utils";

import type { ProductTaxRate } from "./product-form";

export interface ProductListRowProps {
  name: string;
  /** Pre-formatted price for display, e.g. `€2.50`. */
  priceLabel: string;
  taxRatePercent: ProductTaxRate;
  thumbnailUrl?: string | null;
  actions?: React.ReactNode;
  className?: string;
}

export function ProductListRow({
  name,
  priceLabel,
  taxRatePercent,
  thumbnailUrl,
  actions,
  className,
}: ProductListRowProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-b border-border py-2 text-xs last:border-0",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="size-10 shrink-0 border border-border bg-muted/20">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
              —
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}</p>
          <p className="text-muted-foreground tabular-nums">{priceLabel}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="tabular-nums text-muted-foreground">{taxRatePercent}%</span>
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      </div>
    </div>
  );
}
