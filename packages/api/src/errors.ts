import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

export type ErrorHandlerEnv = {
  Variables: {
    logger?: {
      warn: (msg: string, meta?: object) => void;
      error: (msg: string, meta?: object) => void;
    };
  };
};

/**
 * Format ZodError as JSON response body.
 */
export function formatZodError(error: ZodError) {
  return {
    error: "Validation failed",
    issues: error.flatten(),
  };
}

/**
 * Global error handler for Hono apps. Handles HTTPException, ZodError, and unknown errors.
 */
export function createErrorHandler<E extends ErrorHandlerEnv = ErrorHandlerEnv>() {
  return (err: unknown, c: Context<E>): Response => {
    const log = c.get("logger");

    if (err instanceof HTTPException) {
      log?.warn("HTTP error", { status: err.status, message: err.message });
      return err.getResponse();
    }

    if (err instanceof ZodError) {
      return c.json(formatZodError(err), 400);
    }

    log?.error("Unhandled error", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return c.json({ error: "Internal Server Error" }, 500);
  };
}
