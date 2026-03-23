import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@slushomat/db/schema";

import { compareIsoDate, eachIsoDateInclusive } from "./date-helpers";

/** Analytics windows are always interpreted on the Europe/Berlin calendar (business timezone). */
export type BerlinRange = {
  startDate: string;
  endDate: string;
  berlinToday: string;
};

export const ANALYTICS_PRESETS = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
] as const;

export type AnalyticsPreset = (typeof ANALYTICS_PRESETS)[number];

export type AnalyticsWindowInput =
  | { kind: "preset"; preset: AnalyticsPreset }
  | { kind: "range"; startDate: string; endDate: string };

const MAX_RANGE_DAYS = 366;

function assertYmd(d: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${label} must be YYYY-MM-DD`,
    });
  }
}

/**
 * Resolve the visible analytics window. Either a named preset (computed in Berlin time on the DB)
 * or an explicit inclusive date range (Berlin calendar dates).
 */
export async function resolveBerlinAnalyticsWindow(
  db: NodePgDatabase<typeof schema>,
  input: AnalyticsWindowInput,
): Promise<BerlinRange> {
  if (input.kind === "range") {
    assertYmd(input.startDate, "startDate");
    assertYmd(input.endDate, "endDate");
    if (compareIsoDate(input.startDate, input.endDate) > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "startDate must be on or before endDate",
      });
    }
    const span = eachIsoDateInclusive(input.startDate, input.endDate).length;
    if (span > MAX_RANGE_DAYS) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Date range may not exceed ${MAX_RANGE_DAYS} days`,
      });
    }

    const res = await db.execute<{ berlin_today: string }>(sql`
      select
        ((current_timestamp at time zone 'utc') at time zone 'europe/berlin')::date::text as berlin_today
    `);
    const row = res.rows[0];
    if (!row) throw new Error("Failed to read Berlin today");
    return {
      startDate: input.startDate,
      endDate: input.endDate,
      berlinToday: row.berlin_today,
    };
  }

  const preset = input.preset;
  let query;

  switch (preset) {
    case "today":
      query = sql`
        with bt as (
          select ((current_timestamp at time zone 'utc') at time zone 'europe/berlin')::date as d
        )
        select
          d::text as berlin_today,
          d::text as start_date,
          d::text as end_date
        from bt
      `;
      break;
    case "yesterday":
      query = sql`
        with bt as (
          select ((current_timestamp at time zone 'utc') at time zone 'europe/berlin')::date as d
        )
        select
          d::text as berlin_today,
          (d - 1)::text as start_date,
          (d - 1)::text as end_date
        from bt
      `;
      break;
    case "this_week":
      query = sql`
        with bt as (
          select ((current_timestamp at time zone 'utc') at time zone 'europe/berlin')::date as d
        ),
        w as (
          select
            d,
            (d - ((extract(isodow from d)::integer - 1)))::date as week_start
          from bt
        )
        select
          d::text as berlin_today,
          week_start::text as start_date,
          (week_start + 6)::text as end_date
        from w
      `;
      break;
    case "last_week":
      query = sql`
        with bt as (
          select ((current_timestamp at time zone 'utc') at time zone 'europe/berlin')::date as d
        ),
        w as (
          select
            d,
            (d - ((extract(isodow from d)::integer - 1)))::date as this_week_start
          from bt
        )
        select
          d::text as berlin_today,
          (this_week_start - 7)::text as start_date,
          (this_week_start - 1)::text as end_date
        from w
      `;
      break;
    case "this_month":
      query = sql`
        with bt as (
          select ((current_timestamp at time zone 'utc') at time zone 'europe/berlin')::date as d
        ),
        m as (
          select
            d,
            date_trunc('month', d)::date as month_start
          from bt
        )
        select
          d::text as berlin_today,
          month_start::text as start_date,
          (month_start + interval '1 month - 1 day')::date::text as end_date
        from m
      `;
      break;
    case "last_month":
      query = sql`
        with bt as (
          select ((current_timestamp at time zone 'utc') at time zone 'europe/berlin')::date as d
        ),
        m as (
          select
            d,
            date_trunc('month', d)::date as cur_month_start
          from bt
        ),
        p as (
          select
            d,
            (cur_month_start - interval '1 month')::date as month_start,
            (cur_month_start - interval '1 day')::date as month_end
          from m
        )
        select
          d::text as berlin_today,
          month_start::text as start_date,
          month_end::text as end_date
        from p
      `;
      break;
    default: {
      const _exhaustive: never = preset;
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unknown preset: ${_exhaustive}`,
      });
    }
  }

  const res = await db.execute<{
    berlin_today: string;
    start_date: string;
    end_date: string;
  }>(query);
  const row = res.rows[0];
  if (!row) throw new Error(`Failed to resolve Berlin preset window: ${preset}`);
  return {
    berlinToday: row.berlin_today,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}
