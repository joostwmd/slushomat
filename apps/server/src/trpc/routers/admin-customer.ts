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
  machineDeployment,
  machineVersion,
  operatorContract,
  operatorContractVersion,
  organization,
} from "@slushomat/db/schema";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const contractStatusSchema = z.enum([
  "draft",
  "active",
  "terminated",
  "none",
]);

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
          organizationId: operatorContract.organizationId,
          n: sql<number>`count(distinct ${operatorContract.machineId})::int`
            .mapWith(Number)
            .as("n"),
        })
        .from(operatorContract)
        .innerJoin(
          operatorContractVersion,
          eq(operatorContract.currentVersionId, operatorContractVersion.id),
        )
        .where(eq(operatorContractVersion.status, "active"))
        .groupBy(operatorContract.organizationId)
        .as("active_machine_counts");

      const q = ctx.db
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          createdAt: organization.createdAt,
          machineCount: sql<number>`coalesce(${activeMachineCounts.n}, 0)::int`.mapWith(
            Number,
          ),
        })
        .from(organization)
        .leftJoin(
          activeMachineCounts,
          eq(organization.id, activeMachineCounts.organizationId),
        );

      const rows = input.search?.trim()
        ? await q
            .where(ilike(organization.name, `%${input.search.trim()}%`))
            .orderBy(desc(organization.createdAt))
        : await q.orderBy(desc(organization.createdAt));

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
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          createdAt: organization.createdAt,
        })
        .from(organization)
        .where(eq(organization.id, input.organizationId))
        .limit(1);
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
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
          versionNumber: machineVersion.versionNumber,
          status: operatorContractVersion.status,
          versionCreatedAt: operatorContractVersion.createdAt,
        })
        .from(operatorContract)
        .innerJoin(machine, eq(operatorContract.machineId, machine.id))
        .innerJoin(
          machineVersion,
          eq(machine.machineVersionId, machineVersion.id),
        )
        .leftJoin(
          operatorContractVersion,
          eq(operatorContract.currentVersionId, operatorContractVersion.id),
        )
        .where(eq(operatorContract.organizationId, input.organizationId))
        .orderBy(asc(machine.id), desc(operatorContractVersion.createdAt));

      const seen = new Set<string>();
      const picked: {
        machineId: string;
        versionNumber: string;
        contractStatus: z.infer<typeof contractStatusSchema>;
      }[] = [];

      for (const row of contractRows) {
        if (seen.has(row.machineId)) continue;
        seen.add(row.machineId);
        picked.push({
          machineId: row.machineId,
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
      const openRows = await ctx.db
        .select({ machineId: machineDeployment.machineId })
        .from(machineDeployment)
        .where(
          and(
            inArray(machineDeployment.machineId, machineIds),
            isNull(machineDeployment.endedAt),
          ),
        );
      const openSet = new Set(openRows.map((r) => r.machineId));

      return picked.map((p) => ({
        ...p,
        hasOpenDeployment: openSet.has(p.machineId),
      }));
    }),
});
