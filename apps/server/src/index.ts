/**
 * Vercel runs this file after transpile; it must not import workspace TS (those resolve to .ts on disk).
 * The real app (with @slushomat/* inlined) is emitted by tsdown from `http-app.ts` → `dist/http-app.mjs`.
 *
 * Excluded from `tsc` (see tsconfig): types come from the bundle; `dist/` may not exist in a fresh clone.
 */
import app from "../dist/http-app.mjs";

export default app;
