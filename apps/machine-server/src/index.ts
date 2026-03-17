import "dotenv/config";
import { serve } from "@hono/node-server";
import { HTTPException } from "hono/http-exception";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";

import { createCors, formatZodError, healthzResponse } from "@slushomat/api";

import { machineAuthMiddleware } from "./middleware/machine-auth";

const app = new Hono();

// 1. Security headers
app.use("*", secureHeaders());

// 2. CORS - allow machine origins (for dev, use broad origin)
app.use("*", createCors({ origin: process.env.CORS_ORIGIN ?? "*" }));

// 3. Machine auth (stub: allows all for now)
app.use("*", machineAuthMiddleware);

// 4. Health check
app.get("/healthz", (c) => c.json(healthzResponse()));

// 5. Placeholder: is-killed endpoint (returns false for now)
app.get("/is-killed", (c) => c.json({ killed: false }));

// 6. Error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  if (err instanceof ZodError) return c.json(formatZodError(err), 400);
  console.error("Unhandled error", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

const port = Number(process.env.PORT) || 3004;
serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Machine server running on http://localhost:${info.port}`);
  },
);
