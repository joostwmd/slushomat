import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import {
  machine,
  machineVersion,
  operatorContract,
  operatorMachine,
  operatorMachineDisplayName,
} from "@slushomat/db/schema";
import { ensureOperatorMachineDisplayNames } from "../../lib/operator-machine-display-name";
import {
  assertUserMemberOfOrg,
  getOperatorIdForSlug,
} from "../../lib/org-scope";
import { router } from "../init";
import { operatorProcedure } from "../procedures";

const orgSlugInput = z.object({
  orgSlug: z.string().min(1),
});

const machineCardSchema = z.object({
  id: z.string(),
  versionNumber: z.string(),
  internalName: z.string(),
  orgDisplayName: z.string(),
  comments: z.string(),
  disabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

async function resolveOrgWithMembership(
  ctx: { db: typeof db; user: { id: string } },
  orgSlug: string,
): Promise<string> {
  const operatorId = await getOperatorIdForSlug(ctx.db, orgSlug);
  await assertUserMemberOfOrg(ctx.db, ctx.user.id, operatorId);
  return operatorId;
}

async function assertMachineLinkedToOperator(
  dbClient: typeof db,
  operatorId: string,
  machineId: string,
): Promise<void> {
  const [row] = await dbClient
    .select({ id: operatorContract.id })
    .from(operatorContract)
    .innerJoin(
      operatorMachine,
      eq(operatorContract.operatorMachineId, operatorMachine.id),
    )
    .where(
      and(
        eq(operatorContract.operatorId, operatorId),
        eq(operatorMachine.machineId, machineId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Machine not found for this operator",
    });
  }
}

export const operatorMachineRouter = router({
  /**
   * Machines that have at least one operator contract with this operator.
   */
  list: operatorProcedure
    .input(orgSlugInput)
    .output(z.array(machineCardSchema))
    .query(async ({ ctx, input }) => {
      const operatorId = await resolveOrgWithMembership(ctx, input.orgSlug);

      const contractRows = await ctx.db
        .select({ machineId: operatorMachine.machineId })
        .from(operatorContract)
        .innerJoin(
          operatorMachine,
          eq(operatorContract.operatorMachineId, operatorMachine.id),
        )
        .where(eq(operatorContract.operatorId, operatorId));

      const uniqueIds = [...new Set(contractRows.map((r) => r.machineId))];
      if (uniqueIds.length === 0) {
        return [];
      }

      await ensureOperatorMachineDisplayNames(ctx.db, operatorId, uniqueIds);

      return ctx.db
        .select({
          id: machine.id,
          versionNumber: machineVersion.versionNumber,
          internalName: machine.internalName,
          orgDisplayName: operatorMachineDisplayName.orgDisplayName,
          comments: machine.comments,
          disabled: machine.disabled,
          createdAt: machine.createdAt,
          updatedAt: machine.updatedAt,
        })
        .from(machine)
        .innerJoin(
          machineVersion,
          eq(machine.machineVersionId, machineVersion.id),
        )
        .innerJoin(
          operatorMachineDisplayName,
          and(
            eq(operatorMachineDisplayName.machineId, machine.id),
            eq(operatorMachineDisplayName.operatorId, operatorId),
          ),
        )
        .where(inArray(machine.id, uniqueIds))
        .orderBy(desc(machine.createdAt));
    }),

  get: operatorProcedure
    .input(
      orgSlugInput.extend({
        machineId: z.string().min(1),
      }),
    )
    .output(machineCardSchema)
    .query(async ({ ctx, input }) => {
      const operatorId = await resolveOrgWithMembership(ctx, input.orgSlug);
      await assertMachineLinkedToOperator(
        ctx.db,
        operatorId,
        input.machineId,
      );

      await ensureOperatorMachineDisplayNames(ctx.db, operatorId, [
        input.machineId,
      ]);

      const [row] = await ctx.db
        .select({
          id: machine.id,
          versionNumber: machineVersion.versionNumber,
          internalName: machine.internalName,
          orgDisplayName: operatorMachineDisplayName.orgDisplayName,
          comments: machine.comments,
          disabled: machine.disabled,
          createdAt: machine.createdAt,
          updatedAt: machine.updatedAt,
        })
        .from(machine)
        .innerJoin(
          machineVersion,
          eq(machine.machineVersionId, machineVersion.id),
        )
        .innerJoin(
          operatorMachineDisplayName,
          and(
            eq(operatorMachineDisplayName.machineId, machine.id),
            eq(operatorMachineDisplayName.operatorId, operatorId),
          ),
        )
        .where(eq(machine.id, input.machineId))
        .limit(1);

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine not found",
        });
      }

      return row;
    }),

  setOrgDisplayName: operatorProcedure
    .input(
      orgSlugInput.extend({
        machineId: z.string().min(1),
        orgDisplayName: z
          .string()
          .trim()
          .min(1, "Machine name is required")
          .max(200),
      }),
    )
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const operatorId = await resolveOrgWithMembership(ctx, input.orgSlug);
      await assertMachineLinkedToOperator(
        ctx.db,
        operatorId,
        input.machineId,
      );

      const name = input.orgDisplayName.trim();

      await ctx.db
        .insert(operatorMachineDisplayName)
        .values({
          operatorId,
          machineId: input.machineId,
          orgDisplayName: name,
        })
        .onConflictDoUpdate({
          target: [
            operatorMachineDisplayName.operatorId,
            operatorMachineDisplayName.machineId,
          ],
          set: { orgDisplayName: name },
        });

      return { ok: true as const };
    }),
});
