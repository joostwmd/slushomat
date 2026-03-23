import "dotenv/config";
import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { auth } from "@slushomat/auth";
import { createCors, createErrorHandler, healthzResponse } from "@slushomat/api";
import { pool } from "@slushomat/db";
import { env } from "@slushomat/env/server";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/router";
import { machineAuthMiddleware } from "./middleware/machine-auth";
import { requestLogger } from "./middleware/logger";
import { sessionMiddleware } from "./middleware/session";
import { machinePurchaseRoute } from "./routes/machine-purchase";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

// 1. Security headers — CORP must allow cross-origin reads for sibling subdomains
// (admin.slushomat → api.slushomat). CORS still restricts which origins may call the API.
app.use(
  "*",
  secureHeaders({
    crossOriginResourcePolicy: "cross-origin",
  }),
);

// 2. CORS
app.use(
  "*",
  createCors({
    origin: [env.CORS_ORIGIN_ADMIN, env.CORS_ORIGIN_OPERATOR],
  }),
);

// 3. Better Auth routes
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// 4. Request logging
app.use("*", requestLogger);

// 5. Session extraction
app.use("*", sessionMiddleware);

// 5b. Machine API (X-Machine-Key, X-Machine-Id)
const machinePurchaseApi = new Hono<AppEnv>();
machinePurchaseApi.use(machineAuthMiddleware);
machinePurchaseApi.route("/", machinePurchaseRoute);
app.route("/api/machine/purchase", machinePurchaseApi);

// 6. tRPC
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, c) => createContext(c),
    onError({ error, path, type, ctx }) {
      ctx?.logger?.error("tRPC error", {
        path,
        type,
        code: error.code,
        message: error.message,
      });
    },
  }),
);

// 7. Health endpoints
app.get("/healthz", (c) => c.json(healthzResponse()));
app.get("/readyz", async (c) => {
  try {
    await pool.query("SELECT 1");
    return c.json({ status: "ready" });
  } catch {
    return c.json({ status: "not ready" }, 503);
  }
});

// 8. Global error handler (non-tRPC only)
app.onError(createErrorHandler<AppEnv>());

// 9. 404
app.notFound((c) =>
  c.json({ error: "Not Found", path: c.req.path }, 404),
);

export default app;

// Vercel imports the thin `src/index.ts` shim that loads this bundle; do not bind a port there.
if (!process.env.VERCEL) {
  const port = Number.parseInt(process.env.PORT ?? "", 10);
  const listenPort = Number.isFinite(port) && port > 0 ? port : 3000;
  const hostname = process.env.HOST;

  serve(
    {
      fetch: app.fetch,
      port: listenPort,
      ...(hostname ? { hostname } : {}),
    },
    (info) => {
      const host = hostname ?? "localhost";
      console.log(`Server is running on http://${host}:${info.port}`);
    },
  );
}
