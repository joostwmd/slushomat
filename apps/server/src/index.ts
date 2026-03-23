/**
 * Vercel entry: detects Hono, then loads the bundled app (workspace deps inlined).
 * In production, uses the tsdown bundle; in dev, uses the source directly.
 */
import { Hono } from "hono";
import type { AppEnv } from "./types";

// Vercel detection: import Hono at top level so their scanner finds it
const isDev = !process.env.VERCEL && process.env.NODE_ENV !== "production";

let app: Hono<AppEnv>;

if (isDev) {
  // Development: load source directly (tsx/ts-node can resolve workspace packages)
  const { default: devApp } = await import("./http-app.js");
  app = devApp;
} else {
  // Production/Vercel: load the bundled app (workspace deps inlined)
  // @ts-ignore -- bundle has correct type but no .d.ts
  const { default: prodApp } = await import("../dist/http-app.mjs");
  app = prodApp;
}

export default app;