import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  machineSlotConfig,
  operatorContract,
  operatorProduct,
} from "@slushomat/db/schema";
import { getOpenDeploymentForMachine } from "../../lib/machine-lifecycle";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const slotNamesSchema = z.object({
  left: z.string().nullable(),
  middle: z.string().nullable(),
  right: z.string().nullable(),
});

export const adminMachineSlotRouter = router({
  getConfigForMachine: adminProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        machineId: z.string().min(1),
      }),
    )
    .output(
      z.object({
        deploymentId: z.string().nullable(),
        slots: slotNamesSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const [link] = await ctx.db
        .select({ id: operatorContract.id })
        .from(operatorContract)
        .where(
          and(
            eq(operatorContract.organizationId, input.organizationId),
            eq(operatorContract.machineId, input.machineId),
          ),
        )
        .limit(1);

      if (!link) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine not found for this organization",
        });
      }

      const deployment = await getOpenDeploymentForMachine(
        ctx.db,
        input.machineId,
      );

      if (!deployment) {
        return {
          deploymentId: null,
          slots: { left: null, middle: null, right: null },
        };
      }

      const rows = await ctx.db
        .select({
          slot: machineSlotConfig.slot,
          productName: operatorProduct.name,
        })
        .from(machineSlotConfig)
        .leftJoin(
          operatorProduct,
          eq(machineSlotConfig.operatorProductId, operatorProduct.id),
        )
        .where(eq(machineSlotConfig.machineDeploymentId, deployment.id));

      const slots = {
        left: null as string | null,
        middle: null as string | null,
        right: null as string | null,
      };

      for (const r of rows) {
        const key = r.slot as keyof typeof slots;
        if (key in slots) {
          slots[key] = r.productName ?? null;
        }
      }

      return { deploymentId: deployment.id, slots };
    }),
});
