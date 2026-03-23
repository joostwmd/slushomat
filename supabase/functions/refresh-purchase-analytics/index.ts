// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";

/** Must match packages/db migration — unique index required for CONCURRENTLY */
const REFRESH_SQL =
  "REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_purchase_daily_summary";

const LOG_PREFIX = "[refresh-analytics-mv]";

/** Log DB target without user/password (for debugging connection issues). */
function safeDbTarget(dbUrl: string): string {
  try {
    const u = new URL(dbUrl);
    const db = u.pathname.replace(/^\//, "").split("/")[0] || "(no db)";
    return `${u.hostname}:${u.port || "5432"}/${db}`;
  } catch {
    return "(invalid URL)";
  }
}

console.info(`${LOG_PREFIX} worker started`);

function unauthorized(reason: string): Response {
  console.warn(`${LOG_PREFIX} unauthorized: ${reason}`);
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

Deno.serve(async (req: Request) => {
  const reqId = crypto.randomUUID().slice(0, 8);
  console.info(
    `${LOG_PREFIX} request ${reqId} ${req.method} ${req.url.split("?")[0]}`,
  );

  if (req.method !== "POST" && req.method !== "GET") {
    console.warn(`${LOG_PREFIX} request ${reqId} method not allowed`);
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!expected) {
    console.error(`${LOG_PREFIX} request ${reqId} SUPABASE_SERVICE_ROLE_KEY not set`);
    return json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const auth = req.headers.get("Authorization");
  const prefix = "Bearer ";
  if (!auth) {
    return unauthorized("missing Authorization header");
  }
  if (!auth.startsWith(prefix)) {
    return unauthorized("Authorization does not start with Bearer ");
  }
  const token = auth.slice(prefix.length);
  if (token.length !== expected.length) {
    console.warn(
      `${LOG_PREFIX} request ${reqId} bearer length mismatch (got ${token.length}, expected ${expected.length})`,
    );
    return unauthorized("token length mismatch");
  }
  if (token !== expected) {
    console.warn(`${LOG_PREFIX} request ${reqId} bearer token mismatch`);
    return unauthorized("token mismatch");
  }
  console.info(`${LOG_PREFIX} request ${reqId} auth ok`);

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl?.trim()) {
    console.error(`${LOG_PREFIX} request ${reqId} SUPABASE_DB_URL missing`);
    return json(
      {
        error:
          "Missing SUPABASE_DB_URL — set a Postgres connection URI (e.g. session pooler) as an Edge Function secret",
      },
      { status: 500 },
    );
  }
  console.info(
    `${LOG_PREFIX} request ${reqId} connecting to db ${safeDbTarget(dbUrl.trim())}`,
  );

  const sql = postgres(dbUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 120,
    idle_timeout: 30,
  });

  const t0 = performance.now();
  try {
    console.info(`${LOG_PREFIX} request ${reqId} running REFRESH CONCURRENTLY…`);
    await sql.unsafe(REFRESH_SQL);
    const ms = Math.round(performance.now() - t0);
    console.info(
      `${LOG_PREFIX} request ${reqId} refresh ok in ${ms}ms`,
    );
    return json({
      ok: true,
      refreshed: "analytics_purchase_daily_summary",
      durationMs: ms,
      requestId: reqId,
    });
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    console.error(`${LOG_PREFIX} request ${reqId} refresh failed after ${ms}ms`, e);
    const message = e instanceof Error ? e.message : String(e);
    return json(
      { ok: false, error: message, requestId: reqId },
      { status: 500 },
    );
  } finally {
    console.info(`${LOG_PREFIX} request ${reqId} closing sql pool`);
    await sql.end({ timeout: 20 });
  }
});