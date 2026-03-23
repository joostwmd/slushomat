/** ISO `YYYY-MM-DD` lexicographic compare: -1 | 0 | 1 */
export function compareIsoDate(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Previous calendar day (UTC date math on ISO strings — safe for YYYY-MM-DD). */
export function addDaysIso(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Every ISO date from start through end inclusive. */
export function eachIsoDateInclusive(start: string, end: string): string[] {
  if (compareIsoDate(start, end) > 0) return [];
  const out: string[] = [];
  let cur = start;
  while (compareIsoDate(cur, end) <= 0) {
    out.push(cur);
    if (cur === end) break;
    cur = addDaysIso(cur, 1);
  }
  return out;
}
