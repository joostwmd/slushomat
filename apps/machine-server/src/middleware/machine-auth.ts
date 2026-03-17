import { createMiddleware } from "hono/factory";

/**
 * Machine authentication middleware.
 * Validates machineId + machineKey against the database and rejects unauthorized combinations.
 *
 * TODO: Implement when machine credentials are set up in the database.
 * - Extract machineId and machineKey from headers (e.g. X-Machine-Id, X-Machine-Key)
 * - Query database to verify the combination
 * - Reject with 401 and MACHINE_ERROR_CODES.INVALID_MACHINE_CREDENTIALS if invalid
 * - Reject with 403 and MACHINE_ERROR_CODES.MACHINE_DISABLED if machine is disabled
 *
 * For now: allow every request (development mode, no credentials in DB yet).
 */
export const machineAuthMiddleware = createMiddleware(async (_c, next) => {
  // TODO: Implement auth check
  // const machineId = c.req.header("X-Machine-Id");
  // const machineKey = c.req.header("X-Machine-Key");
  // if (!machineId || !machineKey) return c.json({ error: "Missing credentials" }, 401);
  // const machine = await db.query.machine.findFirst({ where: eq(machine.id, machineId) });
  // if (!machine || machine.keyHash !== hash(machineKey)) return c.json({ error: "Invalid credentials" }, 401);
  // if (machine.disabled) return c.json({ error: "Machine disabled" }, 403);
  await next();
});
