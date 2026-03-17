import { createMiddleware } from "hono/factory";
import { auth } from "@slushomat/auth";
import type { AppEnv } from "../types";

export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
  } else {
    c.set("user", session.user);
    c.set("session", session); // full { user, session } for procedures
  }

  await next();
});
