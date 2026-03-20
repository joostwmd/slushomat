import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { auth } from "@slushomat/auth";
import { db } from "@slushomat/db";
import { machine } from "@slushomat/db/schema";

import { MACHINE_ERROR_CODES } from "../errors";

function headerSecret(header: string | undefined): string | null {
  const raw = header?.trim();
  return raw || null;
}

function machineIdFromKeyMetadata(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && "machineId" in metadata) {
    const v = (metadata as { machineId?: unknown }).machineId;
    return typeof v === "string" ? v : null;
  }
  return null;
}

type VerifyApiKeyResponse = {
  valid?: boolean;
  key?: {
    id: string;
    metadata?: unknown;
  } | null;
};

export const machineAuthMiddleware = createMiddleware(async (c, next) => {
  const secret = headerSecret(c.req.header("x-machine-key"));
  const machineIdHeader = c.req.header("x-machine-id")?.trim();

  if (!secret || !machineIdHeader) {
    return c.json(
      { code: MACHINE_ERROR_CODES.INVALID_MACHINE_CREDENTIALS },
      401,
    );
  }

  let verified: VerifyApiKeyResponse;
  try {
    verified = (await auth.api.verifyApiKey({
      body: { key: secret },
    })) as VerifyApiKeyResponse;
  } catch {
    return c.json(
      { code: MACHINE_ERROR_CODES.INVALID_MACHINE_CREDENTIALS },
      401,
    );
  }

  if (!verified?.valid || !verified.key) {
    return c.json(
      { code: MACHINE_ERROR_CODES.INVALID_MACHINE_CREDENTIALS },
      401,
    );
  }

  const metaMid = machineIdFromKeyMetadata(verified.key.metadata);
  if (!metaMid || metaMid !== machineIdHeader) {
    return c.json(
      { code: MACHINE_ERROR_CODES.INVALID_MACHINE_CREDENTIALS },
      401,
    );
  }

  const [row] = await db
    .select()
    .from(machine)
    .where(eq(machine.id, machineIdHeader))
    .limit(1);

  if (!row) {
    return c.json(
      { code: MACHINE_ERROR_CODES.INVALID_MACHINE_CREDENTIALS },
      401,
    );
  }

  if (row.disabled) {
    return c.json({ code: MACHINE_ERROR_CODES.MACHINE_DISABLED }, 403);
  }

  if (!row.apiKeyId || row.apiKeyId !== verified.key.id) {
    return c.json(
      { code: MACHINE_ERROR_CODES.INVALID_MACHINE_CREDENTIALS },
      401,
    );
  }

  c.set("machineId", row.id);
  await next();
});
