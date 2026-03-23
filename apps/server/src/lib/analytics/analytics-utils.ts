/** Safe narrowing for MV / aggregate bigint values surfaced as bigint or number. */
export function bigToNumber(n: bigint): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || n < -max) return Number(n);
  return Number(n);
}

/** Normalise MV `date` / driver values to `YYYY-MM-DD` map keys. */
export function bucketKey(d: unknown): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d);
}
