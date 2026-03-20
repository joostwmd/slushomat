import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "@slushomat/db";
import {
  machineDeployment,
  operatorContract,
  operatorContractVersion,
  purchase,
} from "@slushomat/db/schema";

import { MACHINE_ERROR_CODES } from "../errors";

type MachineVariables = { machineId: string };

const purchaseBodySchema = z.object({
  operatorProductId: z.string().min(1),
  slot: z.enum(["left", "middle", "right"]),
  amountInCents: z.number().int().positive(),
});

export const purchaseRoute = new Hono<{ Variables: MachineVariables }>();

purchaseRoute.post("/", async (c) => {
  const machineId = c.get("machineId");
  if (!machineId) {
    return c.json(
      { code: MACHINE_ERROR_CODES.INVALID_MACHINE_CREDENTIALS },
      401,
    );
  }

  const body = purchaseBodySchema.parse(await c.req.json());

  const [contractRow] = await db
    .select({ organizationId: operatorContract.organizationId })
    .from(operatorContract)
    .innerJoin(
      operatorContractVersion,
      eq(operatorContractVersion.id, operatorContract.currentVersionId),
    )
    .where(
      and(
        eq(operatorContract.machineId, machineId),
        eq(operatorContractVersion.status, "active"),
      ),
    )
    .limit(1);

  if (!contractRow) {
    return c.json({ code: MACHINE_ERROR_CODES.NO_ACTIVE_CONTRACT }, 422);
  }

  const [deploymentRow] = await db
    .select({ businessEntityId: machineDeployment.businessEntityId })
    .from(machineDeployment)
    .where(
      and(
        eq(machineDeployment.machineId, machineId),
        isNull(machineDeployment.endedAt),
      ),
    )
    .limit(1);

  const id = randomUUID();
  const purchasedAt = new Date();

  await db.insert(purchase).values({
    id,
    machineId,
    organizationId: contractRow.organizationId,
    businessEntityId: deploymentRow?.businessEntityId ?? null,
    operatorProductId: body.operatorProductId,
    slot: body.slot,
    amountInCents: body.amountInCents,
    purchasedAt,
  });

  return c.json(
    { id, purchasedAt: purchasedAt.toISOString() },
    201,
  );
});
