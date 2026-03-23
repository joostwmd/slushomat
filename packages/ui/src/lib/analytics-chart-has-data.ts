/** Whether the daily bar chart has any non-zero points to show. */
export function hasDailyBarData(
  rows: { grossCents: number; purchaseCount: number }[],
): boolean {
  if (rows.length === 0) return false;
  return rows.some((r) => r.grossCents > 0 || r.purchaseCount > 0);
}

/** Whether product-by-day rows contain any gross revenue (line / breakdown charts). */
export function hasProductByDayData(rows: { grossCents: number }[]): boolean {
  if (rows.length === 0) return false;
  return rows.some((r) => r.grossCents > 0);
}

/** Pie / totals lists where `grossCents` is the slice size. */
export function hasGrossTotalsData(rows: { grossCents: number }[]): boolean {
  if (rows.length === 0) return false;
  return rows.some((r) => r.grossCents > 0);
}

/** Generic positive slice values (e.g. aggregated pie data). */
export function hasPositivePieValues(values: number[]): boolean {
  return values.some((v) => v > 0);
}

/** Monthly stacked area: any non-zero monetary series. */
export function hasMonthlyFinancialsData(
  rows: {
    grossCents: number;
    platformShareCents: number;
    rentCents: number;
  }[],
): boolean {
  if (rows.length === 0) return false;
  return rows.some(
    (r) =>
      r.grossCents > 0 ||
      r.platformShareCents > 0 ||
      r.rentCents > 0,
  );
}
