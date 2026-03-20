import { eq } from "drizzle-orm";
import { db } from "@slushomat/db";
import { machine } from "@slushomat/db/schema";

import { auth } from "./index";

export const MACHINE_AUTH_ERROR_CODES = {
  INVALID_MACHINE_CREDENTIALS: "INVALID_MACHINE_CREDENTIALS",
  MACHINE_DISABLED: "MACHINE_DISABLED",
} as const;

type VerifyApiKeyResponse = {
  valid?: boolean;
  key?: {
    id: string;
    metadata?: unknown;
  } | null;
};

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

export type VerifyMachineHeadersResult =
  | { ok: true; machineId: string }
  | {
      ok: false;
      status: 401 | 403;
      code: (typeof MACHINE_AUTH_ERROR_CODES)[keyof typeof MACHINE_AUTH_ERROR_CODES];
    };

/**
 * Validates X-Machine-Key (Better Auth API key) and X-Machine-Id against the machine row.
 */
export async function verifyMachineHeaders(
  machineKeyHeader: string | undefined,
  machineIdHeader: string | undefined,
): Promise<VerifyMachineHeadersResult> {
  const secret = headerSecret(machineKeyHeader);
  const machineIdFromHeader = machineIdHeader?.trim();

  if (!secret || !machineIdFromHeader) {
    return {
      ok: false,
      status: 401,
      code: MACHINE_AUTH_ERROR_CODES.INVALID_MACHINE_CREDENTIALS,
    };
  }

  let verified: VerifyApiKeyResponse;
  try {
    verified = (await auth.api.verifyApiKey({
      body: { key: secret },
    })) as VerifyApiKeyResponse;
  } catch {
    return {
      ok: false,
      status: 401,
      code: MACHINE_AUTH_ERROR_CODES.INVALID_MACHINE_CREDENTIALS,
    };
  }

  if (!verified?.valid || !verified.key) {
    return {
      ok: false,
      status: 401,
      code: MACHINE_AUTH_ERROR_CODES.INVALID_MACHINE_CREDENTIALS,
    };
  }

  const metaMid = machineIdFromKeyMetadata(verified.key.metadata);
  if (!metaMid || metaMid !== machineIdFromHeader) {
    return {
      ok: false,
      status: 401,
      code: MACHINE_AUTH_ERROR_CODES.INVALID_MACHINE_CREDENTIALS,
    };
  }

  const [row] = await db
    .select()
    .from(machine)
    .where(eq(machine.id, machineIdFromHeader))
    .limit(1);

  if (!row) {
    return {
      ok: false,
      status: 401,
      code: MACHINE_AUTH_ERROR_CODES.INVALID_MACHINE_CREDENTIALS,
    };
  }

  if (row.disabled) {
    return {
      ok: false,
      status: 403,
      code: MACHINE_AUTH_ERROR_CODES.MACHINE_DISABLED,
    };
  }

  if (!row.apiKeyId || row.apiKeyId !== verified.key.id) {
    return {
      ok: false,
      status: 401,
      code: MACHINE_AUTH_ERROR_CODES.INVALID_MACHINE_CREDENTIALS,
    };
  }

  return { ok: true, machineId: row.id };
}
