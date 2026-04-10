import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { organization, operatorProduct } from "@slushomat/db/schema";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const listItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceInCents: z.number().int(),
  taxRatePercent: z.number().int(),
  createdAt: z.date(),
});

export const adminOperatorProductRouter = router({
  listByOrganization: adminProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .output(z.array(listItemSchema))
    .query(async ({ ctx, input }) => {
      const [op] = await ctx.db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, input.organizationId))
        .limit(1);
      if (!op) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Operator not found",
        });
      }

      return ctx.db
        .select({
          id: operatorProduct.id,
          name: operatorProduct.name,
          priceInCents: operatorProduct.priceInCents,
          taxRatePercent: operatorProduct.taxRatePercent,
          createdAt: operatorProduct.createdAt,
        })
        .from(operatorProduct)
        .where(eq(operatorProduct.operatorId, input.organizationId))
        .orderBy(desc(operatorProduct.createdAt));
    }),
});
