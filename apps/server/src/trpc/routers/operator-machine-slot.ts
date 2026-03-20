import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import {
  businessEntity,
  machineSlotConfig,
  operatorProduct,
} from "@slushomat/db/schema";
import { getOpenDeploymentForMachine } from "../../lib/machine-lifecycle";
import {
  assertUserMemberOfOrg,
  getOrganizationIdForSlug,
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
  const organizationId = await getOrganizationIdForSlug(ctx.db, orgSlug);
  await assertUserMemberOfOrg(ctx.db, ctx.user.id, organizationId);
  return organizationId;
}

/**
 * Open deployment for machine whose linked business entity belongs to `organizationId`.
 */
async function requireOpenDeploymentForOrgMachine(
  dbClient: typeof db,
  organizationId: string,
  machineId: string,
) {
  const deployment = await getOpenDeploymentForMachine(dbClient, machineId);
  if (!deployment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No open deployment for this machine",
    });
  }
  const [be] = await dbClient
    .select({ organizationId: businessEntity.organizationId })
    .from(businessEntity)
    .where(eq(businessEntity.id, deployment.businessEntityId))
    .limit(1);
  if (!be || be.organizationId !== organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Deployment is not for this organization",
    });
  }
  return deployment;
}

async function requireOperatorProductInOrg(
  dbClient: typeof db,
  organizationId: string,
  operatorProductId: string,
) {
  const [row] = await dbClient
    .select({ id: operatorProduct.id })
    .from(operatorProduct)
    .where(
      and(
        eq(operatorProduct.id, operatorProductId),
        eq(operatorProduct.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Product not found in this organization",
    });
  }
}

export const operatorMachineSlotRouter = router({
  getConfigForMachine: operatorProcedure
    .input(orgSlugMachineInput)
    .output(slotConfigOutputSchema)
    .query(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );
      const deployment = await requireOpenDeploymentForOrgMachine(
        ctx.db,
        organizationId,
        input.machineId,
      );

      const rows = await ctx.db
        .select({
          slot: machineSlotConfig.slot,
          operatorProductId: machineSlotConfig.operatorProductId,
        })
        .from(machineSlotConfig)
        .where(
          eq(machineSlotConfig.machineDeploymentId, deployment.id),
        );

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

      return { deploymentId: deployment.id, slots };
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
      const organizationId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );
      const deployment = await requireOpenDeploymentForOrgMachine(
        ctx.db,
        organizationId,
        input.machineId,
      );

      const entries = Object.entries(input.slots) as [
        z.infer<typeof slotKeySchema>,
        string | null,
      ][];

      for (const [, productId] of entries) {
        if (productId !== null) {
          await requireOperatorProductInOrg(
            ctx.db,
            organizationId,
            productId,
          );
        }
      }

      await ctx.db.transaction(async (tx) => {
        for (const [slot, operatorProductId] of entries) {
          const id = randomUUID();
          await tx
            .insert(machineSlotConfig)
            .values({
              id,
              machineDeploymentId: deployment.id,
              slot,
              operatorProductId,
            })
            .onConflictDoUpdate({
              target: [
                machineSlotConfig.machineDeploymentId,
                machineSlotConfig.slot,
              ],
              set: {
                operatorProductId,
                updatedAt: new Date(),
              },
            });
        }
      });

      const rows = await ctx.db
        .select({
          slot: machineSlotConfig.slot,
          operatorProductId: machineSlotConfig.operatorProductId,
        })
        .from(machineSlotConfig)
        .where(
          eq(machineSlotConfig.machineDeploymentId, deployment.id),
        );

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

      return { deploymentId: deployment.id, slots };
    }),
});
