import { createMiddleware } from "hono/factory";
import { verifyMachineHeaders } from "@slushomat/auth/machine-credentials";

import type { AppEnv } from "../types";

export const machineAuthMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const result = await verifyMachineHeaders(
    c.req.header("x-machine-key"),
    c.req.header("x-machine-id"),
  );

  if (!result.ok) {
    return c.json({ code: result.code }, result.status);
  }

  c.set("machineId", result.machineId);
  await next();
});
