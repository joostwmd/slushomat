import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { auth } from "@slushomat/auth";
import { pool } from "@slushomat/db";
import { env } from "@slushomat/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/router";
import { requestLogger } from "./middleware/logger";
import { sessionMiddleware } from "./middleware/session";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

// 1. Security headers
app.use("*", secureHeaders());

// 2. CORS
app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
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
app.get("/healthz", (c) => c.json({ status: "ok", uptime: process.uptime() }));
app.get("/readyz", async (c) => {
  try {
    await pool.query("SELECT 1");
    return c.json({ status: "ready" });
  } catch {
    return c.json({ status: "not ready" }, 503);
  }
});

// 8. Global error handler (non-tRPC only)
app.onError((err, c) => {
  const log = c.get("logger");

  if (err instanceof HTTPException) {
    log?.warn("HTTP error", { status: err.status, message: err.message });
    return err.getResponse();
  }

  if (err instanceof ZodError) {
    return c.json(
      { error: "Validation failed", issues: err.flatten() },
      400,
    );
  }

  log?.error("Unhandled error", { error: err.message, stack: err.stack });
  return c.json({ error: "Internal Server Error" }, 500);
});

// 9. 404
app.notFound((c) =>
  c.json({ error: "Not Found", path: c.req.path }, 404),
);

// Serve
import { serve } from "@hono/node-server";

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
