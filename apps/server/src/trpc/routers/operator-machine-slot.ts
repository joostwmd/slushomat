import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import {
  businessEntity,
  machineSlot,
  operatorProduct,
} from "@slushomat/db/schema";
import { getOpenOperatorMachineForMachine } from "../../lib/machine-lifecycle";
import {
  assertUserMemberOfOrg,
  getOperatorIdForSlug,
} from "../../lib/org-scope";
import { router } from "../init";
import { operatorProcedure } from "../procedures";

const slotKeySchema = z.enum(["left", "middle", "right"]);

const orgSlugMachineInput = z.object({
  orgSlug: z.string().min(1),
  machineId: z.string().min(1),
});

const slotConfigOutputSchema = z.object({
  deploymentId: z.string(),
  slots: z.object({
    left: z.string().nullable(),
    middle: z.string().nullable(),
    right: z.string().nullable(),
  }),
});

async function resolveOrgWithMembership(
  ctx: { db: typeof db; user: { id: string } },
  orgSlug: string,
): Promise<string> {
  const operatorId = await getOperatorIdForSlug(ctx.db, orgSlug);
  await assertUserMemberOfOrg(ctx.db, ctx.user.id, operatorId);
  return operatorId;
}

/**
 * Open operator_machine row for machine whose business entity belongs to `operatorId`.
 */
async function requireOpenOperatorMachineForOperator(
  dbClient: typeof db,
  operatorId: string,
  machineId: string,
) {
  const openOm = await getOpenOperatorMachineForMachine(dbClient, machineId);
  if (!openOm) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No open deployment for this machine",
    });
  }
  if (openOm.operatorId !== operatorId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Deployment is not for this operator",
    });
  }
  const [be] = await dbClient
    .select({ operatorId: businessEntity.operatorId })
    .from(businessEntity)
    .where(eq(businessEntity.id, openOm.businessEntityId))
    .limit(1);
  if (!be || be.operatorId !== operatorId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Deployment is not for this operator",
    });
  }
  return openOm;
}

async function requireOperatorProductInOperator(
  dbClient: typeof db,
  operatorId: string,
  operatorProductId: string,
) {
  const [row] = await dbClient
    .select({ id: operatorProduct.id })
    .from(operatorProduct)
    .where(
      and(
        eq(operatorProduct.id, operatorProductId),
        eq(operatorProduct.operatorId, operatorId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Product not found for this operator",
    });
  }
}

export const operatorMachineSlotRouter = router({
  getConfigForMachine: operatorProcedure
    .input(orgSlugMachineInput)
    .output(slotConfigOutputSchema)
    .query(async ({ ctx, input }) => {
      const operatorId = await resolveOrgWithMembership(ctx, input.orgSlug);
      const openOm = await requireOpenOperatorMachineForOperator(
        ctx.db,
        operatorId,
        input.machineId,
      );

      const rows = await ctx.db
        .select({
          slot: machineSlot.slot,
          operatorProductId: machineSlot.operatorProductId,
        })
        .from(machineSlot)
        .where(eq(machineSlot.operatorMachineId, openOm.id));

      const slots = {
        left: null as string | null,
        middle: null as string | null,
        right: null as string | null,
      };
      for (const r of rows) {
        const key = r.slot as "left" | "middle" | "right";
        if (key in slots) {
          slots[key] = r.operatorProductId;
        }
      }

      return { deploymentId: openOm.id, slots };
    }),

  setSlots: operatorProcedure
    .input(
      orgSlugMachineInput.extend({
        slots: z.object({
          left: z.string().nullable(),
          middle: z.string().nullable(),
          right: z.string().nullable(),
        }),
      }),
    )
    .output(slotConfigOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const operatorId = await resolveOrgWithMembership(ctx, input.orgSlug);
      const openOm = await requireOpenOperatorMachineForOperator(
        ctx.db,
        operatorId,
        input.machineId,
      );

      const entries = Object.entries(input.slots) as [
        z.infer<typeof slotKeySchema>,
        string | null,
      ][];

      for (const [, productId] of entries) {
        if (productId !== null) {
          await requireOperatorProductInOperator(
            ctx.db,
            operatorId,
            productId,
          );
        }
      }

      await ctx.db.transaction(async (tx) => {
        for (const [slot, operatorProductId] of entries) {
          const id = randomUUID();
          await tx
            .insert(machineSlot)
            .values({
              id,
              operatorMachineId: openOm.id,
              slot,
              operatorProductId,
            })
            .onConflictDoUpdate({
              target: [machineSlot.operatorMachineId, machineSlot.slot],
              set: {
                operatorProductId,
                updatedAt: new Date(),
              },
            });
        }
      });

      const rows = await ctx.db
        .select({
          slot: machineSlot.slot,
          operatorProductId: machineSlot.operatorProductId,
        })
        .from(machineSlot)
        .where(eq(machineSlot.operatorMachineId, openOm.id));

      const slots = {
        left: null as string | null,
        middle: null as string | null,
        right: null as string | null,
      };
      for (const r of rows) {
        const key = r.slot as "left" | "middle" | "right";
        if (key in slots) {
          slots[key] = r.operatorProductId;
        }
      }

      return { deploymentId: openOm.id, slots };
    }),
});
