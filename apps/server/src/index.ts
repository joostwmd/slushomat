import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { auth } from "@slushomat/auth";
import { createCors, createErrorHandler, healthzResponse } from "@slushomat/api";
import { pool } from "@slushomat/db";
import { env } from "@slushomat/env/server";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/router";
import { requestLogger } from "./middleware/logger";
import { sessionMiddleware } from "./middleware/session";
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

// Serve (respect PORT/HOST from portless and other hosts)
import { serve } from "@hono/node-server";

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
