import { Button } from "@slushomat/ui/base/button";
import { Input } from "@slushomat/ui/base/input";
import { Label } from "@slushomat/ui/base/label";
import { cn } from "@slushomat/ui/lib/utils";

export type AnalyticsMode = "day" | "week" | "month";

export type AnalyticsPeriod = {
  mode: AnalyticsMode;
  anchorDate: string;
};

export function localTodayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftAnalyticsAnchor(
  iso: string,
  mode: AnalyticsMode,
  steps: number,
): string {
  const [y, mo, d] = iso.split("-").map(Number);
  if (!y || !mo || !d) return iso;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (mode === "day") dt.setUTCDate(dt.getUTCDate() + steps);
  else if (mode === "week") dt.setUTCDate(dt.getUTCDate() + 7 * steps);
  else dt.setUTCMonth(dt.getUTCMonth() + steps);
  return dt.toISOString().slice(0, 10);
}

const MODES: { id: AnalyticsMode; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export function AnalyticsTimeControls({
  value,
  onChange,
  className,
  idPrefix = "analytics",
}: {
  value: AnalyticsPeriod;
  onChange: (next: AnalyticsPeriod) => void;
  className?: string;
  /** Avoid duplicate `id`s when multiple controls mount (e.g. dev tools). */
  idPrefix?: string;
}) {
  const dateId = `${idPrefix}-anchor-date`;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex rounded-none border border-border">
        {MODES.map(({ id, label }) => (
          <Button
            key={id}
            type="button"
            variant={value.mode === id ? "secondary" : "ghost"}
            size="sm"
            className="rounded-none border-0 shadow-none first:rounded-s-none last:rounded-e-none"
            onClick={() => onChange({ ...value, mode: id })}
          >
            {label}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-none"
        onClick={() =>
          onChange({
            ...value,
            anchorDate: shiftAnalyticsAnchor(value.anchorDate, value.mode, -1),
          })
        }
      >
        Previous
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-none"
        onClick={() =>
          onChange({
            ...value,
            anchorDate: shiftAnalyticsAnchor(value.anchorDate, value.mode, 1),
          })
        }
      >
        Next
      </Button>
      <div className="flex items-center gap-2">
        <Label
          htmlFor={dateId}
          className="text-xs text-muted-foreground whitespace-nowrap"
        >
          Period
        </Label>
        <Input
          id={dateId}
          type="date"
          className="h-8 w-[11rem] rounded-none text-xs"
          value={value.anchorDate}
          onChange={(e) =>
            onChange({ ...value, anchorDate: e.target.value || value.anchorDate })
          }
        />
      </div>
    </div>
  );
}
