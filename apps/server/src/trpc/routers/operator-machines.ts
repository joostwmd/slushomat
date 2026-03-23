import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import {
  machine,
  machineVersion,
  operatorContract,
  organizationMachineDisplayName,
} from "@slushomat/db/schema";
import { ensureOrganizationMachineDisplayNames } from "../../lib/organization-machine-display-name";
import {
  assertUserMemberOfOrg,
  getOrganizationIdForSlug,
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
  const organizationId = await getOrganizationIdForSlug(ctx.db, orgSlug);
  await assertUserMemberOfOrg(ctx.db, ctx.user.id, organizationId);
  return organizationId;
}

async function assertMachineLinkedToOrg(
  dbClient: typeof db,
  organizationId: string,
  machineId: string,
): Promise<void> {
  const [row] = await dbClient
    .select({ id: operatorContract.id })
    .from(operatorContract)
    .where(
      and(
        eq(operatorContract.organizationId, organizationId),
        eq(operatorContract.machineId, machineId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Machine not found for this organization",
    });
  }
}

export const operatorMachineRouter = router({
  /**
   * Machines that have at least one operator contract with this organization.
   */
  list: operatorProcedure
    .input(orgSlugInput)
    .output(z.array(machineCardSchema))
    .query(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );

      const contractRows = await ctx.db
        .select({ machineId: operatorContract.machineId })
        .from(operatorContract)
        .where(eq(operatorContract.organizationId, organizationId));

      const uniqueIds = [...new Set(contractRows.map((r) => r.machineId))];
      if (uniqueIds.length === 0) {
        return [];
      }

      await ensureOrganizationMachineDisplayNames(
        ctx.db,
        organizationId,
        uniqueIds,
      );

      return ctx.db
        .select({
          id: machine.id,
          versionNumber: machineVersion.versionNumber,
          internalName: machine.internalName,
          orgDisplayName: organizationMachineDisplayName.orgDisplayName,
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
          organizationMachineDisplayName,
          and(
            eq(organizationMachineDisplayName.machineId, machine.id),
            eq(
              organizationMachineDisplayName.organizationId,
              organizationId,
            ),
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
      const organizationId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );
      await assertMachineLinkedToOrg(
        ctx.db,
        organizationId,
        input.machineId,
      );

      await ensureOrganizationMachineDisplayNames(
        ctx.db,
        organizationId,
        [input.machineId],
      );

      const [row] = await ctx.db
        .select({
          id: machine.id,
          versionNumber: machineVersion.versionNumber,
          internalName: machine.internalName,
          orgDisplayName: organizationMachineDisplayName.orgDisplayName,
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
          organizationMachineDisplayName,
          and(
            eq(organizationMachineDisplayName.machineId, machine.id),
            eq(
              organizationMachineDisplayName.organizationId,
              organizationId,
            ),
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
      const organizationId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );
      await assertMachineLinkedToOrg(
        ctx.db,
        organizationId,
        input.machineId,
      );

      const name = input.orgDisplayName.trim();

      await ctx.db
        .insert(organizationMachineDisplayName)
        .values({
          organizationId,
          machineId: input.machineId,
          orgDisplayName: name,
        })
        .onConflictDoUpdate({
          target: [
            organizationMachineDisplayName.organizationId,
            organizationMachineDisplayName.machineId,
          ],
          set: { orgDisplayName: name },
        });

      return { ok: true as const };
    }),
});
