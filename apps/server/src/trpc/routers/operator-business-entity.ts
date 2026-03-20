import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import { businessEntity } from "@slushomat/db/schema";
import {
  assertBusinessEntityBelongsToOrg,
} from "../../lib/machine-lifecycle";
import {
  assertUserMemberOfOrg,
  getOrganizationIdForSlug,
} from "../../lib/org-scope";
import { router } from "../init";
import { operatorProcedure } from "../procedures";

const orgSlugInput = z.object({
  orgSlug: z.string().min(1),
});

const entityRow = z.object({
  id: z.string(),
  organizationId: z.string(),
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

async function resolveOrgWithMembership(
  ctx: { db: typeof db; user: { id: string } },
  orgSlug: string,
): Promise<string> {
  const organizationId = await getOrganizationIdForSlug(ctx.db, orgSlug);
  await assertUserMemberOfOrg(ctx.db, ctx.user.id, organizationId);
  return organizationId;
}

export const operatorBusinessEntityRouter = router({
  list: operatorProcedure
    .input(orgSlugInput)
    .output(z.array(entityRow))
    .query(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );
      const rows = await ctx.db
        .select()
        .from(businessEntity)
        .where(
          and(
            eq(businessEntity.organizationId, organizationId),
            isNull(businessEntity.deletedAt),
          ),
        )
        .orderBy(desc(businessEntity.createdAt));
      return rows as unknown as EntityRow[];
    }),

  create: operatorProcedure
    .input(
      orgSlugInput.extend({
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
      const organizationId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );
      const id = randomUUID();
      const inserted = (await ctx.db
        .insert(businessEntity)
        .values({
          id,
          organizationId,
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

  update: operatorProcedure
    .input(
      orgSlugInput.extend({
        id: z.string().min(1),
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
      const organizationId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );
      await assertBusinessEntityBelongsToOrg(
        ctx.db,
        input.id,
        organizationId,
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

  softDelete: operatorProcedure
    .input(
      orgSlugInput.extend({
        id: z.string().min(1),
      }),
    )
    .output(entityRow)
    .mutation(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );
      await assertBusinessEntityBelongsToOrg(
        ctx.db,
        input.id,
        organizationId,
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
