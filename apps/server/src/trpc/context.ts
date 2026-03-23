import type { Context as HonoContext } from "hono";
import { db } from "@slushomat/db";
import type { AppEnv } from "../types";

export type Context = {
  user: AppEnv["Variables"]["user"];
  session: AppEnv["Variables"]["session"];
  logger: AppEnv["Variables"]["logger"];
  requestId: AppEnv["Variables"]["requestId"];
  db: typeof db;
  headers: Headers;
};

export async function createContext(c: HonoContext<AppEnv>): Promise<Context> {
  return {
    user: c.get("user"),
    session: c.get("session"),
    logger: c.get("logger"),
    requestId: c.get("requestId"),
    db,
    // Use Hono's header map — avoids `Request.headers` typing when `lib` has no DOM (e.g. Vercel's tsc step).
    headers: new Headers(c.req.header()),
  };
}
