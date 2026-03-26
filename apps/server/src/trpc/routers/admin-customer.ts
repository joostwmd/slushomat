import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  machine,
  machineVersion,
  member,
  operator,
  operatorContract,
  operatorContractVersion,
  operatorMachine,
  operatorMachineDisplayName,
  user,
} from "@slushomat/db/schema";
import { ensureOperatorMachineDisplayNames } from "../../lib/operator-machine-display-name";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const contractStatusSchema = z.enum([
  "draft",
  "active",
  "terminated",
  "none",
]);

/** `organizationId` in API = operator (tenant) id — kept for admin UI compatibility. */
export const adminCustomerRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
        })
        .optional()
        .default({}),
    )
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
          createdAt: z.date(),
          machineCount: z.number().int(),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      const activeMachineCounts = ctx.db
        .select({
          operatorId: operatorContract.operatorId,
          n: sql<number>`count(distinct ${operatorMachine.machineId})::int`
            .mapWith(Number)
            .as("n"),
        })
        .from(operatorContract)
        .innerJoin(
          operatorMachine,
          eq(operatorContract.operatorMachineId, operatorMachine.id),
        )
        .innerJoin(
          operatorContractVersion,
          eq(operatorContract.currentVersionId, operatorContractVersion.id),
        )
        .where(eq(operatorContractVersion.status, "active"))
        .groupBy(operatorContract.operatorId)
        .as("active_machine_counts");

      const q = ctx.db
        .select({
          id: operator.id,
          name: operator.name,
          slug: operator.slug,
          createdAt: operator.createdAt,
          machineCount: sql<number>`coalesce(${activeMachineCounts.n}, 0)::int`.mapWith(
            Number,
          ),
        })
        .from(operator)
        .leftJoin(
          activeMachineCounts,
          eq(operator.id, activeMachineCounts.operatorId),
        );

      const rows = input.search?.trim()
        ? await q
            .where(ilike(operator.name, `%${input.search.trim()}%`))
            .orderBy(desc(operator.createdAt))
        : await q.orderBy(desc(operator.createdAt));

      return rows;
    }),

  get: adminProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .output(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        createdAt: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          id: operator.id,
          name: operator.name,
          slug: operator.slug,
          createdAt: operator.createdAt,
        })
        .from(operator)
        .where(eq(operator.id, input.organizationId))
        .limit(1);
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Operator not found",
        });
      }
      return row;
    }),

  listMachines: adminProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .output(
      z.array(
        z.object({
          machineId: z.string(),
          internalName: z.string(),
          orgDisplayName: z.string(),
          versionNumber: z.string(),
          contractStatus: contractStatusSchema,
          hasOpenDeployment: z.boolean(),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      const contractRows = await ctx.db
        .select({
          machineId: machine.id,
          internalName: machine.internalName,
          versionNumber: machineVersion.versionNumber,
          status: operatorContractVersion.status,
          versionCreatedAt: operatorContractVersion.createdAt,
        })
        .from(operatorContract)
        .innerJoin(
          operatorMachine,
          eq(operatorContract.operatorMachineId, operatorMachine.id),
        )
        .innerJoin(machine, eq(operatorMachine.machineId, machine.id))
        .innerJoin(
          machineVersion,
          eq(machine.machineVersionId, machineVersion.id),
        )
        .leftJoin(
          operatorContractVersion,
          eq(operatorContract.currentVersionId, operatorContractVersion.id),
        )
        .where(eq(operatorContract.operatorId, input.organizationId))
        .orderBy(asc(machine.id), desc(operatorContractVersion.createdAt));

      const seen = new Set<string>();
      const picked: {
        machineId: string;
        internalName: string;
        versionNumber: string;
        contractStatus: z.infer<typeof contractStatusSchema>;
      }[] = [];

      for (const row of contractRows) {
        if (seen.has(row.machineId)) continue;
        seen.add(row.machineId);
        picked.push({
          machineId: row.machineId,
          internalName: row.internalName,
          versionNumber: row.versionNumber,
          contractStatus:
            (row.status as z.infer<typeof contractStatusSchema> | undefined) ??
            "none",
        });
      }

      if (picked.length === 0) {
        return [];
      }

      const machineIds = picked.map((p) => p.machineId);

      await ensureOperatorMachineDisplayNames(
        ctx.db,
        input.organizationId,
        machineIds,
      );

      const nameRows = await ctx.db
        .select({
          machineId: operatorMachineDisplayName.machineId,
          orgDisplayName: operatorMachineDisplayName.orgDisplayName,
        })
        .from(operatorMachineDisplayName)
        .where(
          and(
            eq(
              operatorMachineDisplayName.operatorId,
              input.organizationId,
            ),
            inArray(operatorMachineDisplayName.machineId, machineIds),
          ),
        );
      const orgNameByMachine = new Map(
        nameRows.map((r) => [r.machineId, r.orgDisplayName]),
      );

      const openRows = await ctx.db
        .select({ machineId: operatorMachine.machineId })
        .from(operatorMachine)
        .where(
          and(
            inArray(operatorMachine.machineId, machineIds),
            isNull(operatorMachine.undeployedAt),
          ),
        );
      const openSet = new Set(openRows.map((r) => r.machineId));

      return picked.map((p) => ({
        ...p,
        orgDisplayName: orgNameByMachine.get(p.machineId) ?? "",
        hasOpenDeployment: openSet.has(p.machineId),
      }));
    }),

  /** Better Auth organization plugin uses `owner` for the creating member. */
  getOrganizationOwner: adminProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .output(
      z
        .object({
          userId: z.string(),
          name: z.string(),
          email: z.string(),
          role: z.string(),
        })
        .nullable(),
    )
    .query(async ({ ctx, input }) => {
      const [org] = await ctx.db
        .select({ id: operator.id })
        .from(operator)
        .where(eq(operator.id, input.organizationId))
        .limit(1);
      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Operator not found",
        });
      }

      const [owner] = await ctx.db
        .select({
          userId: user.id,
          name: user.name,
          email: user.email,
          role: member.role,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(
          and(
            eq(member.operatorId, input.organizationId),
            eq(member.role, "owner"),
          ),
        )
        .limit(1);

      return owner ?? null;
    }),

  /** Sets `machine.disabled` for every machine linked to the operator via operator contracts. */
  disableAllMachines: adminProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .output(z.object({ count: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const [org] = await ctx.db
        .select({ id: operator.id })
        .from(operator)
        .where(eq(operator.id, input.organizationId))
        .limit(1);
      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Operator not found",
        });
      }

      const idRows = await ctx.db
        .select({ machineId: operatorMachine.machineId })
        .from(operatorContract)
        .innerJoin(
          operatorMachine,
          eq(operatorContract.operatorMachineId, operatorMachine.id),
        )
        .where(eq(operatorContract.operatorId, input.organizationId))
        .groupBy(operatorMachine.machineId);

      if (idRows.length === 0) {
        return { count: 0 };
      }

      const machineIds = idRows.map((r) => r.machineId);
      const updated = await ctx.db
        .update(machine)
        .set({ disabled: true })
        .where(inArray(machine.id, machineIds))
        .returning({ id: machine.id });

      return { count: updated.length };
    }),
});
