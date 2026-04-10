import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { businessEntity, organization } from "@slushomat/db/schema";
import { assertBusinessEntityBelongsToOperator } from "../../lib/machine-lifecycle";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const entityRow = z.object({
  id: z.string(),
  operatorId: z.string(),
  name: z.string(),
  legalName: z.string(),
  legalForm: z.string(),
  vatId: z.string(),
  street: z.string(),
  city: z.string(),
  postalCode: z.string(),
  country: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

type EntityRow = z.infer<typeof entityRow>;

async function requireOperator(
  ctx: { db: typeof import("@slushomat/db").db },
  operatorId: string,
) {
  const [row] = await ctx.db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, operatorId))
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Operator not found",
    });
  }
}

export const adminBusinessEntityRouter = router({
  listByOrganization: adminProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .output(z.array(entityRow))
    .query(async ({ ctx, input }) => {
      await requireOperator(ctx, input.organizationId);
      const rows = await ctx.db
        .select()
        .from(businessEntity)
        .where(eq(businessEntity.operatorId, input.organizationId))
        .orderBy(desc(businessEntity.createdAt));
      return rows as unknown as EntityRow[];
    }),

  create: adminProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        name: z.string().min(1),
        legalName: z.string().min(1),
        legalForm: z.string().min(1),
        vatId: z.string().min(1),
        street: z.string().min(1),
        city: z.string().min(1),
        postalCode: z.string().min(1),
        country: z.string().min(1).default("DE"),
      }),
    )
    .output(entityRow)
    .mutation(async ({ ctx, input }) => {
      await requireOperator(ctx, input.organizationId);
      const id = crypto.randomUUID();
      const inserted = (await ctx.db
        .insert(businessEntity)
        .values({
          id,
          operatorId: input.organizationId,
          name: input.name.trim(),
          legalName: input.legalName.trim(),
          legalForm: input.legalForm.trim(),
          vatId: input.vatId.trim(),
          street: input.street.trim(),
          city: input.city.trim(),
          postalCode: input.postalCode.trim(),
          country: input.country.trim() || "DE",
        })
        .returning()) as EntityRow[];
      const row = inserted[0];
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create business entity",
        });
      }
      return row as unknown as EntityRow;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        organizationId: z.string().min(1),
        name: z.string().min(1),
        legalName: z.string().min(1),
        legalForm: z.string().min(1),
        vatId: z.string().min(1),
        street: z.string().min(1),
        city: z.string().min(1),
        postalCode: z.string().min(1),
        country: z.string().min(1),
      }),
    )
    .output(entityRow)
    .mutation(async ({ ctx, input }) => {
      await assertBusinessEntityBelongsToOperator(
        ctx.db,
        input.id,
        input.organizationId,
      );
      const updated = await ctx.db
        .update(businessEntity)
        .set({
          name: input.name.trim(),
          legalName: input.legalName.trim(),
          legalForm: input.legalForm.trim(),
          vatId: input.vatId.trim(),
          street: input.street.trim(),
          city: input.city.trim(),
          postalCode: input.postalCode.trim(),
          country: input.country.trim(),
        })
        .where(eq(businessEntity.id, input.id))
        .returning();
      const row = updated[0];
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business entity not found",
        });
      }
      return row as unknown as EntityRow;
    }),

  softDelete: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        organizationId: z.string().min(1),
      }),
    )
    .output(entityRow)
    .mutation(async ({ ctx, input }) => {
      await assertBusinessEntityBelongsToOperator(
        ctx.db,
        input.id,
        input.organizationId,
      );
      const updated = await ctx.db
        .update(businessEntity)
        .set({ deletedAt: new Date() })
        .where(eq(businessEntity.id, input.id))
        .returning();
      const row = updated[0];
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business entity not found",
        });
      }
      return row as unknown as EntityRow;
    }),
});
