import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@slushomat/db/schema";

export type AnalyticsMode = "day" | "week" | "month";

export type BerlinRange = {
  startDate: string;
  endDate: string;
  berlinToday: string;
};

function assertYmd(anchorDate: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) {
    throw new Error("anchorDate must be YYYY-MM-DD");
  }
}

/**
 * Resolve calendar range for `anchorDate` (YYYY-MM-DD, Berlin wall calendar) and mode.
 * Week = ISO week (Mon–Sun) containing the anchor.
 */
export async function resolveBerlinRange(
  db: NodePgDatabase<typeof schema>,
  mode: AnalyticsMode,
  anchorDate: string,
): Promise<BerlinRange> {
  assertYmd(anchorDate);

  if (mode === "day") {
    const res = await db.execute<{
      start_date: string;
      end_date: string;
      berlin_today: string;
    }>(sql`
      select
        ${anchorDate}::date::text as start_date,
        ${anchorDate}::date::text as end_date,
        ((current_timestamp at time zone 'utc') at time zone 'europe/berlin')::date::text as berlin_today
    `);
    const row = res.rows[0];
    if (!row) throw new Error("Failed to resolve Berlin day range");
    return {
      startDate: row.start_date,
      endDate: row.end_date,
      berlinToday: row.berlin_today,
    };
  }

  if (mode === "week") {
    const res = await db.execute<{
      start_date: string;
      end_date: string;
      berlin_today: string;
    }>(sql`
      select
        (${anchorDate}::date - ((extract(isodow from ${anchorDate}::date)::integer - 1)))::text as start_date,
        ((${anchorDate}::date - ((extract(isodow from ${anchorDate}::date)::integer - 1))) + 6)::text as end_date,
        ((current_timestamp at time zone 'utc') at time zone 'europe/berlin')::date::text as berlin_today
    `);
    const row = res.rows[0];
    if (!row) throw new Error("Failed to resolve Berlin week range");
    return {
      startDate: row.start_date,
      endDate: row.end_date,
      berlinToday: row.berlin_today,
    };
  }

  const res = await db.execute<{
    start_date: string;
    end_date: string;
    berlin_today: string;
  }>(sql`
    select
      date_trunc('month', ${anchorDate}::date)::date::text as start_date,
      (date_trunc('month', ${anchorDate}::date) + interval '1 month - 1 day')::date::text as end_date,
      ((current_timestamp at time zone 'utc') at time zone 'europe/berlin')::date::text as berlin_today
  `);
  const row = res.rows[0];
  if (!row) throw new Error("Failed to resolve Berlin month range");
  return {
    startDate: row.start_date,
    endDate: row.end_date,
    berlinToday: row.berlin_today,
  };
}
