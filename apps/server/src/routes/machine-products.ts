import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "@slushomat/db";
import {
  machineSlot,
  operatorMachine,
  operatorProduct,
  productImageWithPublicUrl,
} from "@slushomat/db/schema";
import { env } from "@slushomat/env/server";

import { resolvePublicStorageImageUrl } from "../lib/product-image";
import type { AppEnv } from "../types";

const NO_ACTIVE_DEPLOYMENT = "NO_ACTIVE_DEPLOYMENT";
const MACHINE_DISABLED = "MACHINE_DISABLED";

export const machineProductsRoute = new Hono<AppEnv>();

machineProductsRoute.get("/", async (c) => {
  const machineId = c.get("machineId");
  if (!machineId) {
    return c.json({ success: false as const, error: "INVALID_MACHINE_CREDENTIALS" }, 401);
  }

  const [deployment] = await db
    .select({
      id: operatorMachine.id,
      status: operatorMachine.status,
    })
    .from(operatorMachine)
    .where(
      and(
        eq(operatorMachine.machineId, machineId),
        isNull(operatorMachine.undeployedAt),
      ),
    )
    .limit(1);

  if (!deployment) {
    return c.json({ success: false as const, error: NO_ACTIVE_DEPLOYMENT }, 404);
  }

  if (deployment.status === "killed") {
    return c.json({ success: false as const, error: MACHINE_DISABLED }, 423);
  }

  const rows = await db
    .select({
      machineSlotId: machineSlot.id,
      name: operatorProduct.name,
      price: operatorProduct.priceInCents,
      storagePath: productImageWithPublicUrl.imageUrl,
    })
    .from(machineSlot)
    .innerJoin(
      operatorMachine,
      eq(machineSlot.operatorMachineId, operatorMachine.id),
    )
    .innerJoin(
      operatorProduct,
      eq(machineSlot.operatorProductId, operatorProduct.id),
    )
    .leftJoin(
      productImageWithPublicUrl,
      eq(operatorProduct.productImageId, productImageWithPublicUrl.id),
    )
    .where(
      and(
        eq(operatorMachine.machineId, machineId),
        isNull(operatorMachine.undeployedAt),
        isNotNull(machineSlot.operatorProductId),
      ),
    )
    .orderBy(machineSlot.slot);

  const data = rows.map((r) => ({
    machineSlotId: r.machineSlotId,
    name: r.name,
    price: r.price,
    imageUrl: resolvePublicStorageImageUrl(env.SUPABASE_URL, r.storagePath),
  }));

  return c.json({ success: true as const, data });
});
