import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import { businessEntity, machine, operatorMachine } from "@slushomat/db/schema";
import {
  assertBusinessEntityBelongsToOperator,
  getOpenOperatorMachineForMachine,
} from "../../lib/machine-lifecycle";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const deploymentRow = z.object({
  id: z.string(),
  machineId: z.string(),
  businessEntityId: z.string(),
  operatorId: z.string(),
  machineDisplayName: z.string(),
  businessEntityDisplayName: z.string(),
  deployedAt: z.date(),
  undeployedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const deploymentSelectShape = {
  id: operatorMachine.id,
  machineId: operatorMachine.machineId,
  businessEntityId: operatorMachine.businessEntityId,
  operatorId: operatorMachine.operatorId,
  machineDisplayName: sql<string>`coalesce(nullif(trim(${machine.internalName}), ''), 'Unnamed machine')`.as(
    "machine_display_name",
  ),
  businessEntityDisplayName: businessEntity.name,
  deployedAt: operatorMachine.deployedAt,
  undeployedAt: operatorMachine.undeployedAt,
  createdAt: operatorMachine.createdAt,
  updatedAt: operatorMachine.updatedAt,
} as const;

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
        .select(deploymentSelectShape)
        .from(operatorMachine)
        .innerJoin(machine, eq(operatorMachine.machineId, machine.id))
        .innerJoin(
          businessEntity,
          eq(operatorMachine.businessEntityId, businessEntity.id),
        )
        .orderBy(desc(operatorMachine.deployedAt));
    }),

  listOpenForMachine: adminProcedure
    .input(z.object({ machineId: z.string().min(1) }))
    .output(z.array(deploymentRow))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select(deploymentSelectShape)
        .from(operatorMachine)
        .innerJoin(machine, eq(operatorMachine.machineId, machine.id))
        .innerJoin(
          businessEntity,
          eq(operatorMachine.businessEntityId, businessEntity.id),
        )
        .where(
          and(
            eq(operatorMachine.machineId, input.machineId),
            isNull(operatorMachine.undeployedAt),
          ),
        );
    }),

  start: adminProcedure
    .input(
      z.object({
        machineId: z.string().min(1),
        businessEntityId: z.string().min(1),
        /** Operator that owns the business entity (for validation). */
        operatorId: z.string().min(1),
      }),
    )
    .output(deploymentRow)
    .mutation(async ({ ctx, input }) => {
      await requireMachine(ctx, input.machineId);
      await assertBusinessEntityBelongsToOperator(
        ctx.db,
        input.businessEntityId,
        input.operatorId,
      );

      const id = randomUUID();

      await ctx.db.transaction(async (tx) => {
        const existing = await getOpenOperatorMachineForMachine(
          tx,
          input.machineId,
        );
        if (existing) {
          await tx
            .update(operatorMachine)
            .set({ undeployedAt: new Date(), status: "inactive" })
            .where(eq(operatorMachine.id, existing.id));
        }

        await tx.insert(operatorMachine).values({
          id,
          operatorId: input.operatorId,
          machineId: input.machineId,
          businessEntityId: input.businessEntityId,
          status: "active",
        });
      });

      const [enriched] = await ctx.db
        .select(deploymentSelectShape)
        .from(operatorMachine)
        .innerJoin(machine, eq(operatorMachine.machineId, machine.id))
        .innerJoin(
          businessEntity,
          eq(operatorMachine.businessEntityId, businessEntity.id),
        )
        .where(eq(operatorMachine.id, id))
        .limit(1);

      if (!enriched) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load operator machine after start",
        });
      }
      return enriched;
    }),

  end: adminProcedure
    .input(z.object({ deploymentId: z.string().min(1) }))
    .output(deploymentRow)
    .mutation(async ({ ctx, input }) => {
      const [current] = await ctx.db
        .select()
        .from(operatorMachine)
        .where(eq(operatorMachine.id, input.deploymentId))
        .limit(1);
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Operator machine assignment not found",
        });
      }
      if (current.undeployedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Assignment is already ended",
        });
      }
      const [updated] = await ctx.db
        .update(operatorMachine)
        .set({ undeployedAt: new Date(), status: "inactive" })
        .where(eq(operatorMachine.id, input.deploymentId))
        .returning({ id: operatorMachine.id });
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to end assignment",
        });
      }

      const [enriched] = await ctx.db
        .select(deploymentSelectShape)
        .from(operatorMachine)
        .innerJoin(machine, eq(operatorMachine.machineId, machine.id))
        .innerJoin(
          businessEntity,
          eq(operatorMachine.businessEntityId, businessEntity.id),
        )
        .where(eq(operatorMachine.id, input.deploymentId))
        .limit(1);

      if (!enriched) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load assignment after end",
        });
      }
      return enriched;
    }),
});
