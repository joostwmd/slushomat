import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import { machine, machineDeployment } from "@slushomat/db/schema";
import {
  assertBusinessEntityBelongsToOrg,
  getOpenDeploymentForMachine,
} from "../../lib/machine-lifecycle";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const deploymentRow = z.object({
  id: z.string(),
  machineId: z.string(),
  businessEntityId: z.string(),
  startedAt: z.date(),
  endedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

async function requireMachine(ctx: { db: typeof db }, machineId: string) {
  const [row] = await ctx.db
    .select({ id: machine.id })
    .from(machine)
    .where(eq(machine.id, machineId))
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Machine not found",
    });
  }
}

export const adminMachineDeploymentRouter = router({
  list: adminProcedure
    .output(z.array(deploymentRow))
    .query(async ({ ctx }) => {
      return ctx.db
        .select()
        .from(machineDeployment)
        .orderBy(desc(machineDeployment.startedAt));
    }),

  listOpenForMachine: adminProcedure
    .input(z.object({ machineId: z.string().min(1) }))
    .output(z.array(deploymentRow))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(machineDeployment)
        .where(
          and(
            eq(machineDeployment.machineId, input.machineId),
            isNull(machineDeployment.endedAt),
          ),
        );
    }),

  start: adminProcedure
    .input(
      z.object({
        machineId: z.string().min(1),
        businessEntityId: z.string().min(1),
        /** Organization that owns the business entity (for validation). */
        organizationId: z.string().min(1),
      }),
    )
    .output(deploymentRow)
    .mutation(async ({ ctx, input }) => {
      await requireMachine(ctx, input.machineId);
      await assertBusinessEntityBelongsToOrg(
        ctx.db,
        input.businessEntityId,
        input.organizationId,
      );

      const id = randomUUID();

      const row = await ctx.db.transaction(async (tx) => {
        const existing = await getOpenDeploymentForMachine(tx, input.machineId);
        if (existing) {
          await tx
            .update(machineDeployment)
            .set({ endedAt: new Date() })
            .where(eq(machineDeployment.id, existing.id));
        }

        const [inserted] = await tx
          .insert(machineDeployment)
          .values({
            id,
            machineId: input.machineId,
            businessEntityId: input.businessEntityId,
          })
          .returning();
        return inserted;
      });

      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start deployment",
        });
      }
      return row;
    }),

  end: adminProcedure
    .input(z.object({ deploymentId: z.string().min(1) }))
    .output(deploymentRow)
    .mutation(async ({ ctx, input }) => {
      const [current] = await ctx.db
        .select()
        .from(machineDeployment)
        .where(eq(machineDeployment.id, input.deploymentId))
        .limit(1);
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }
      if (current.endedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deployment is already ended",
        });
      }
      const [row] = await ctx.db
        .update(machineDeployment)
        .set({ endedAt: new Date() })
        .where(eq(machineDeployment.id, input.deploymentId))
        .returning();
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to end deployment",
        });
      }
      return row;
    }),
});
