"use client";

import { Button } from "@slushomat/ui/base/button";
import { cn } from "@slushomat/ui/lib/utils";
import { PencilIcon, ArchiveIcon } from "lucide-react";

export interface BusinessEntityListRowProps {
  name: string;
  legalName: string;
  city: string;
  country: string;
  vatId: string;
  onEdit?: () => void;
  onArchive?: () => void;
  disabled?: boolean;
  className?: string;
}

export function BusinessEntityListRow({
  name,
  legalName,
  city,
  country,
  vatId,
  onEdit,
  onArchive,
  disabled = false,
  className,
}: BusinessEntityListRowProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b border-border py-3 text-sm last:border-b-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{legalName}</p>
        <p className="text-xs text-muted-foreground">
          {city}, {country} · VAT {vatId}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        {onEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-none text-xs"
            onClick={onEdit}
            disabled={disabled}
          >
            <PencilIcon className="mr-1 size-3.5" />
            Edit
          </Button>
        ) : null}
        {onArchive ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-none text-xs"
            onClick={onArchive}
            disabled={disabled}
          >
            <ArchiveIcon className="mr-1 size-3.5" />
            Archive
          </Button>
        ) : null}
      </div>
    </div>
  );
}
