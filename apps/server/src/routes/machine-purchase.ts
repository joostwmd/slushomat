import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "@slushomat/db";
import {
  machineSlot,
  operatorContract,
  operatorContractVersion,
  operatorMachine,
  purchase,
} from "@slushomat/db/schema";

import type { AppEnv } from "../types";

const NO_ACTIVE_CONTRACT = "NO_ACTIVE_CONTRACT";
const INVALID_SLOT = "INVALID_SLOT";
const MACHINE_DISABLED = "MACHINE_DISABLED";

const purchaseBodySchema = z.object({
  machineSlotId: z.string().min(1),
  amountInCents: z.number().int().positive(),
});

export const machinePurchaseRoute = new Hono<AppEnv>();

machinePurchaseRoute.post("/", async (c) => {
  const machineId = c.get("machineId");
  if (!machineId) {
    return c.json({ code: "INVALID_MACHINE_CREDENTIALS" }, 401);
  }

  const body = purchaseBodySchema.parse(await c.req.json());

  const [slotRow] = await db
    .select({
      slotId: machineSlot.id,
      operatorMachineId: machineSlot.operatorMachineId,
      operatorProductId: machineSlot.operatorProductId,
      omMachineId: operatorMachine.machineId,
      operatorId: operatorMachine.operatorId,
      businessEntityId: operatorMachine.businessEntityId,
      status: operatorMachine.status,
    })
    .from(machineSlot)
    .innerJoin(
      operatorMachine,
      eq(machineSlot.operatorMachineId, operatorMachine.id),
    )
    .where(eq(machineSlot.id, body.machineSlotId))
    .limit(1);

  if (!slotRow || slotRow.omMachineId !== machineId) {
    return c.json({ code: INVALID_SLOT }, 422);
  }

  if (slotRow.status === "killed") {
    return c.json({ code: MACHINE_DISABLED }, 423);
  }

  if (!slotRow.operatorProductId) {
    return c.json({ code: INVALID_SLOT }, 422);
  }

  const [contractRow] = await db
    .select({ id: operatorContract.id })
    .from(operatorContract)
    .innerJoin(
      operatorContractVersion,
      eq(operatorContractVersion.id, operatorContract.currentVersionId),
    )
    .where(
      and(
        eq(operatorContract.operatorMachineId, slotRow.operatorMachineId),
        eq(operatorContractVersion.status, "active"),
      ),
    )
    .limit(1);

  if (!contractRow) {
    return c.json({ code: NO_ACTIVE_CONTRACT }, 422);
  }

  const id = randomUUID();
  const purchasedAt = new Date();

  await db.insert(purchase).values({
    id,
    machineSlotId: body.machineSlotId,
    machineId,
    operatorId: slotRow.operatorId,
    businessEntityId: slotRow.businessEntityId,
    operatorProductId: slotRow.operatorProductId,
    amountInCents: body.amountInCents,
    purchasedAt,
  });

  return c.json({ id, purchasedAt: purchasedAt.toISOString() }, 201);
});
