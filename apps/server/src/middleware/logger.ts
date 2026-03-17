import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

function createLogger(
  requestId: string,
  path: string,
  method: string,
): AppEnv["Variables"]["logger"] {
  return {
    info: (msg, meta) =>
      console.log(JSON.stringify({ requestId, path, method, msg, ...meta })),
    warn: (msg, meta) =>
      console.warn(JSON.stringify({ requestId, path, method, msg, ...meta })),
    error: (msg, meta) =>
      console.error(JSON.stringify({ requestId, path, method, msg, ...meta })),
  };
}

export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);

  const logger = createLogger(requestId, c.req.path, c.req.method);
  c.set("logger", logger);

  const start = Date.now();
  logger.info("Request started");

  await next();

  logger.info("Request completed", {
    status: c.res.status,
    durationMs: Date.now() - start,
  });
});
