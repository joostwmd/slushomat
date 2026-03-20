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

import type { AppEnv } from "../types";

const NO_ACTIVE_CONTRACT = "NO_ACTIVE_CONTRACT";

const purchaseBodySchema = z.object({
  operatorProductId: z.string().min(1),
  slot: z.enum(["left", "middle", "right"]),
  amountInCents: z.number().int().positive(),
});

export const machinePurchaseRoute = new Hono<AppEnv>();

machinePurchaseRoute.post("/", async (c) => {
  const machineId = c.get("machineId");
  if (!machineId) {
    return c.json({ code: "INVALID_MACHINE_CREDENTIALS" }, 401);
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
    return c.json({ code: NO_ACTIVE_CONTRACT }, 422);
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

  return c.json({ id, purchasedAt: purchasedAt.toISOString() }, 201);
});
