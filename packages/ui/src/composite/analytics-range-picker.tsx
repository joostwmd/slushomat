"use client";

import { TZDate } from "@date-fns/tz";
import * as React from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@slushomat/ui/base/button";
import { Calendar } from "@slushomat/ui/base/calendar";
import { Card, CardContent, CardFooter } from "@slushomat/ui/base/card";
import { cn } from "@slushomat/ui/lib/utils";

import {
  type AnalyticsPresetId,
  berlinPresetToDateRange,
  formatDateBerlinYmd,
} from "../lib/analytics-berlin-preset-dates";

export type { AnalyticsPresetId };

export type AnalyticsWindowValue =
  | { kind: "preset"; preset: AnalyticsPresetId }
  | { kind: "range"; startDate: string; endDate: string };

const PRESET_LABEL: Record<AnalyticsPresetId, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  last_month: "Last month",
};

/** Left column: current period; right column: previous (pairwise). */
const PRESET_GRID_ROWS: [AnalyticsPresetId, AnalyticsPresetId][] = [
  ["today", "yesterday"],
  ["this_week", "last_week"],
  ["this_month", "last_month"],
];

function parseBerlinYmd(ymd: string): Date {
  return new TZDate(`${ymd}T12:00:00`, "Europe/Berlin");
}

function rangeFromValue(value: AnalyticsWindowValue): DateRange {
  if (value.kind === "preset") {
    const { from, to } = berlinPresetToDateRange(value.preset);
    return { from, to };
  }
  return {
    from: parseBerlinYmd(value.startDate),
    to: parseBerlinYmd(value.endDate),
  };
}

function startOfVisibleMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function defaultAnalyticsWindow(): AnalyticsWindowValue {
  return { kind: "preset", preset: "this_week" };
}

/** Maps UI state to tRPC `analyticsWindowFields` input (exactly one branch). */
export function analyticsWindowToTrpcInput(
  v: AnalyticsWindowValue,
): { preset: AnalyticsPresetId; startDate?: never; endDate?: never } | {
  preset?: never;
  startDate: string;
  endDate: string;
} {
  if (v.kind === "preset") {
    return { preset: v.preset };
  }
  return { startDate: v.startDate, endDate: v.endDate };
}

export type AnalyticsRangePickerProps = {
  value: AnalyticsWindowValue;
  onChange: (next: AnalyticsWindowValue) => void;
  className?: string;
};

/**
 * Preset shortcuts under the calendar (card layout). Selection uses
 * **Europe/Berlin** (same as analytics APIs).
 */
export function AnalyticsRangePicker({
  value,
  onChange,
  className,
}: AnalyticsRangePickerProps) {
  const selected = React.useMemo(() => rangeFromValue(value), [value]);

  const anchor = selected.from ?? selected.to;
  const [month, setMonth] = React.useState<Date>(() =>
    anchor ? startOfVisibleMonth(anchor) : new Date(),
  );

  const valueSyncKey =
    value.kind === "preset" ? value.preset : `${value.startDate}:${value.endDate}`;

  React.useEffect(() => {
    const range = rangeFromValue(value);
    const a = range.from ?? range.to;
    if (a) setMonth(startOfVisibleMonth(a));
    // Intentionally key off stable window identity so a new object reference with the same preset/range does not reset calendar navigation.
  }, [valueSyncKey]);

  return (
    <div className={cn("flex w-fit max-w-full flex-col gap-2", className)}>
      <Card size="sm" className="mx-auto w-fit max-w-full gap-0 py-0">
        <CardContent className="p-0">
          <Calendar
            mode="range"
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                onChange({
                  kind: "range",
                  startDate: formatDateBerlinYmd(range.from),
                  endDate: formatDateBerlinYmd(range.to),
                });
                setMonth(startOfVisibleMonth(range.from));
              }
            }}
            numberOfMonths={1}
            fixedWeeks
            className="p-0 [--cell-size:2.375rem]"
          />
        </CardContent>
        <CardFooter className="grid grid-cols-2 gap-2 border-t">
          {PRESET_GRID_ROWS.flatMap(([left, right]) => [left, right]).map(
            (id) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={
                  value.kind === "preset" && value.preset === id
                    ? "secondary"
                    : "outline"
                }
                className="w-full rounded-none"
                onClick={() => {
                  onChange({ kind: "preset", preset: id });
                  const { from } = berlinPresetToDateRange(id);
                  setMonth(startOfVisibleMonth(from));
                }}
              >
                {PRESET_LABEL[id]}
              </Button>
            ),
          )}
        </CardFooter>
      </Card>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Berlin time. Purchase table filters are separate.
      </p>
    </div>
  );
}
