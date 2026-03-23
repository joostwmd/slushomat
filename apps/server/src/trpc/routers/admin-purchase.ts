import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  businessEntity,
  machine,
  operatorContract,
  operatorProduct,
  organizationMachineDisplayName,
  purchase,
} from "@slushomat/db/schema";
import { ensureOrganizationMachineDisplayNames } from "../../lib/organization-machine-display-name";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const purchaseRowSchema = z.object({
  id: z.string(),
  machineId: z.string(),
  machineLabel: z.string(),
  organizationId: z.string(),
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
    organizationId: z.string().optional(),
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

      if (input.organizationId) {
        conds.push(eq(purchase.organizationId, input.organizationId));
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

      if (input.organizationId) {
        const contractMachineRows = await ctx.db
          .select({ machineId: operatorContract.machineId })
          .from(operatorContract)
          .where(eq(operatorContract.organizationId, input.organizationId));
        const orgMachineIds = [
          ...new Set(contractMachineRows.map((r) => r.machineId)),
        ];
        await ensureOrganizationMachineDisplayNames(
          ctx.db,
          input.organizationId,
          orgMachineIds,
        );
      }

      const base = ctx.db
        .select({
          id: purchase.id,
          machineId: purchase.machineId,
          machineLabel: sql<string>`coalesce(${organizationMachineDisplayName.orgDisplayName}, ${machine.internalName}, ${purchase.machineId})`.as(
            "machine_label",
          ),
          organizationId: purchase.organizationId,
          businessEntityId: purchase.businessEntityId,
          operatorProductId: purchase.operatorProductId,
          productName: operatorProduct.name,
          slot: purchase.slot,
          amountInCents: purchase.amountInCents,
          purchasedAt: purchase.purchasedAt,
          businessEntityName: businessEntity.name,
        })
        .from(purchase)
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
          organizationMachineDisplayName,
          and(
            eq(organizationMachineDisplayName.machineId, purchase.machineId),
            eq(
              organizationMachineDisplayName.organizationId,
              purchase.organizationId,
            ),
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
