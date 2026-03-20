import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import {
  businessEntity,
  operatorProduct,
  purchase,
} from "@slushomat/db/schema";
import {
  assertUserMemberOfOrg,
  getOrganizationIdForSlug,
} from "../../lib/org-scope";
import { router } from "../init";
import { operatorProcedure } from "../procedures";

const purchaseRowSchema = z.object({
  id: z.string(),
  machineId: z.string(),
  businessEntityId: z.string().nullable(),
  operatorProductId: z.string(),
  productName: z.string(),
  slot: z.enum(["left", "middle", "right"]),
  amountInCents: z.number().int(),
  purchasedAt: z.date(),
  businessEntityName: z.string().nullable(),
});

const listInputSchema = z.object({
  orgSlug: z.string().min(1),
  machineId: z.string().optional(),
  businessEntityId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  cursor: z.string().optional(),
});

async function resolveOrgWithMembership(
  ctx: { db: typeof import("@slushomat/db").db; user: { id: string } },
  orgSlug: string,
): Promise<string> {
  const organizationId = await getOrganizationIdForSlug(ctx.db, orgSlug);
  await assertUserMemberOfOrg(ctx.db, ctx.user.id, organizationId);
  return organizationId;
}

export const operatorPurchaseRouter = router({
  list: operatorProcedure
    .input(listInputSchema)
    .output(z.array(purchaseRowSchema))
    .query(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );

      const conds = [eq(purchase.organizationId, organizationId)];

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

      const limit = input.limit ?? 100;

      const rows = await ctx.db
        .select({
          id: purchase.id,
          machineId: purchase.machineId,
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
        .where(and(...conds))
        .orderBy(desc(purchase.purchasedAt))
        .limit(limit);

      return rows.map((r) => ({
        ...r,
        slot: r.slot as "left" | "middle" | "right",
        businessEntityName: r.businessEntityName ?? null,
      }));
    }),
});
