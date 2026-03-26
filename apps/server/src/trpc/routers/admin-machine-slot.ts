import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  machineSlot,
  operatorContract,
  operatorMachine,
  operatorProduct,
} from "@slushomat/db/schema";
import { getOpenOperatorMachineForMachine } from "../../lib/machine-lifecycle";
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
        .innerJoin(
          operatorMachine,
          eq(operatorContract.operatorMachineId, operatorMachine.id),
        )
        .where(
          and(
            eq(operatorContract.operatorId, input.organizationId),
            eq(operatorMachine.machineId, input.machineId),
          ),
        )
        .limit(1);

      if (!link) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine not found for this operator",
        });
      }

      const openOm = await getOpenOperatorMachineForMachine(
        ctx.db,
        input.machineId,
      );

      if (!openOm) {
        return {
          deploymentId: null,
          slots: { left: null, middle: null, right: null },
        };
      }

      const rows = await ctx.db
        .select({
          slot: machineSlot.slot,
          productName: operatorProduct.name,
        })
        .from(machineSlot)
        .leftJoin(
          operatorProduct,
          eq(machineSlot.operatorProductId, operatorProduct.id),
        )
        .where(eq(machineSlot.operatorMachineId, openOm.id));

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

      return { deploymentId: openOm.id, slots };
    }),
});
