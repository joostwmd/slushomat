import { TZDate } from "@date-fns/tz";
import {
  endOfISOWeek,
  endOfMonth,
  startOfISOWeek,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";

/** Must match `ANALYTICS_PRESETS` on the server (`berlin-range.ts`). */
export const ANALYTICS_PRESET_IDS = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
] as const;

export type AnalyticsPresetId = (typeof ANALYTICS_PRESET_IDS)[number];

const BERLIN = "Europe/Berlin";

function berlinToday(): TZDate {
  return new TZDate(new Date(), BERLIN);
}

/** Calendar display range for a preset (Berlin wall calendar; mirrors server SQL). */
export function berlinPresetToDateRange(
  preset: AnalyticsPresetId,
): { from: Date; to: Date } {
  const today = berlinToday();
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = subDays(today, 1);
      return { from: y, to: y };
    }
    case "this_week": {
      const from = startOfISOWeek(today);
      const to = endOfISOWeek(today);
      return { from, to };
    }
    case "last_week": {
      const thisStart = startOfISOWeek(today);
      const from = subDays(thisStart, 7);
      const to = subDays(thisStart, 1);
      return { from, to };
    }
    case "this_month": {
      const from = startOfMonth(today);
      const to = endOfMonth(today);
      return { from, to };
    }
    case "last_month": {
      const inLast = subMonths(today, 1);
      const from = startOfMonth(inLast);
      const to = endOfMonth(inLast);
      return { from, to };
    }
    default: {
      const _x: never = preset;
      throw new Error(`Unknown preset ${_x}`);
    }
  }
}

/** Format a Berlin-calendar YYYY-MM-DD for API payloads. */
export function formatDateBerlinYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
