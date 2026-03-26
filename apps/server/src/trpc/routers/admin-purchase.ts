import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  businessEntity,
  machine,
  machineSlot,
  operatorContract,
  operatorMachine,
  operatorProduct,
  operatorMachineDisplayName,
  purchase,
} from "@slushomat/db/schema";
import { ensureOperatorMachineDisplayNames } from "../../lib/operator-machine-display-name";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const purchaseRowSchema = z.object({
  id: z.string(),
  machineId: z.string(),
  machineLabel: z.string(),
  operatorId: z.string(),
  businessEntityId: z.string().nullable(),
  operatorProductId: z.string(),
  productName: z.string(),
  slot: z.enum(["left", "middle", "right"]),
  amountInCents: z.number().int(),
  purchasedAt: z.date(),
  businessEntityName: z.string().nullable(),
});

const listInputSchema = z
  .object({
    operatorId: z.string().optional(),
    machineId: z.string().optional(),
    businessEntityId: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    limit: z.number().int().min(1).max(500).optional(),
    cursor: z.string().optional(),
  })
  .optional()
  .default({});

export const adminPurchaseRouter = router({
  list: adminProcedure
    .input(listInputSchema)
    .output(z.array(purchaseRowSchema))
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 100;
      const conds = [];

      if (input.operatorId) {
        conds.push(eq(purchase.operatorId, input.operatorId));
      }
      if (input.machineId) {
        conds.push(eq(purchase.machineId, input.machineId));
      }
      if (input.businessEntityId) {
        conds.push(eq(purchase.businessEntityId, input.businessEntityId));
      }
      if (input.startDate) {
        conds.push(gte(purchase.purchasedAt, input.startDate));
      }
      if (input.endDate) {
        conds.push(lte(purchase.purchasedAt, input.endDate));
      }

      if (input.operatorId) {
        const contractMachineRows = await ctx.db
          .select({ machineId: operatorMachine.machineId })
          .from(operatorContract)
          .innerJoin(
            operatorMachine,
            eq(operatorContract.operatorMachineId, operatorMachine.id),
          )
          .where(eq(operatorContract.operatorId, input.operatorId));
        const orgMachineIds = [
          ...new Set(contractMachineRows.map((r) => r.machineId)),
        ];
        await ensureOperatorMachineDisplayNames(
          ctx.db,
          input.operatorId,
          orgMachineIds,
        );
      }

      const base = ctx.db
        .select({
          id: purchase.id,
          machineId: purchase.machineId,
          machineLabel: sql<string>`coalesce(${operatorMachineDisplayName.orgDisplayName}, ${machine.internalName}, ${purchase.machineId})`.as(
            "machine_label",
          ),
          operatorId: purchase.operatorId,
          businessEntityId: purchase.businessEntityId,
          operatorProductId: purchase.operatorProductId,
          productName: operatorProduct.name,
          slot: machineSlot.slot,
          amountInCents: purchase.amountInCents,
          purchasedAt: purchase.purchasedAt,
          businessEntityName: businessEntity.name,
        })
        .from(purchase)
        .innerJoin(machineSlot, eq(purchase.machineSlotId, machineSlot.id))
        .innerJoin(
          operatorProduct,
          eq(purchase.operatorProductId, operatorProduct.id),
        )
        .leftJoin(
          businessEntity,
          eq(purchase.businessEntityId, businessEntity.id),
        )
        .leftJoin(machine, eq(purchase.machineId, machine.id))
        .leftJoin(
          operatorMachineDisplayName,
          and(
            eq(operatorMachineDisplayName.machineId, purchase.machineId),
            eq(operatorMachineDisplayName.operatorId, purchase.operatorId),
          ),
        );

      const rows =
        conds.length > 0
          ? await base
              .where(and(...conds))
              .orderBy(desc(purchase.purchasedAt))
              .limit(limit)
          : await base.orderBy(desc(purchase.purchasedAt)).limit(limit);

      return rows.map((r) => ({
        ...r,
        slot: r.slot as "left" | "middle" | "right",
        businessEntityName: r.businessEntityName ?? null,
      }));
    }),
});
