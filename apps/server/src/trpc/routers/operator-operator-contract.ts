import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import {
  operatorContract,
  operatorContractVersion,
} from "@slushomat/db/schema";
import { getProductImageStorage } from "../../lib/contract-pdf";
import {
  assertUserMemberOfOrg,
  getOrganizationIdForSlug,
} from "../../lib/org-scope";
import { router } from "../init";
import { operatorProcedure } from "../procedures";

const contractStatusSchema = z.enum(["draft", "active", "terminated"]);

const orgSlugInput = z.object({
  orgSlug: z.string().min(1),
});

const operatorContractGetOutput = z.object({
  contract: z.object({
    id: z.string(),
    organizationId: z.string(),
    businessEntityId: z.string(),
    machineId: z.string(),
    currentVersionId: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
  versions: z.array(
    z.object({
      id: z.string(),
      entityId: z.string(),
      versionNumber: z.number(),
      status: contractStatusSchema,
      effectiveDate: z.date(),
      endedAt: z.date().nullable(),
      monthlyRentInCents: z.number(),
      revenueShareBasisPoints: z.number(),
      pdfBucket: z.string().nullable(),
      pdfObjectPath: z.string().nullable(),
      notes: z.string().nullable(),
      createdAt: z.date(),
    }),
  ),
});

type OperatorContractGetOutput = z.infer<typeof operatorContractGetOutput>;

const contractListItemSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  businessEntityId: z.string(),
  machineId: z.string(),
  currentVersionId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  status: contractStatusSchema,
  effectiveDate: z.date(),
  endedAt: z.date().nullable(),
  monthlyRentInCents: z.number(),
  revenueShareBasisPoints: z.number(),
  pdfBucket: z.string().nullable(),
  pdfObjectPath: z.string().nullable(),
  notes: z.string().nullable(),
});

async function resolveOrgWithMembership(
  ctx: { db: typeof db; user: { id: string } },
  orgSlug: string,
): Promise<string> {
  const organizationId = await getOrganizationIdForSlug(ctx.db, orgSlug);
  await assertUserMemberOfOrg(ctx.db, ctx.user.id, organizationId);
  return organizationId;
}

export const operatorOperatorContractRouter = router({
  list: operatorProcedure
    .input(
      orgSlugInput.extend({
        machineId: z.string().optional(),
      }),
    )
    .output(z.array(contractListItemSchema))
    .query(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );

      const conds = [eq(operatorContract.organizationId, organizationId)];
      if (input.machineId) {
        conds.push(eq(operatorContract.machineId, input.machineId));
      }

      const rows = await ctx.db
        .select({
          id: operatorContract.id,
          organizationId: operatorContract.organizationId,
          businessEntityId: operatorContract.businessEntityId,
          machineId: operatorContract.machineId,
          currentVersionId: operatorContract.currentVersionId,
          createdAt: operatorContract.createdAt,
          updatedAt: operatorContract.updatedAt,
          status: operatorContractVersion.status,
          effectiveDate: operatorContractVersion.effectiveDate,
          endedAt: operatorContractVersion.endedAt,
          monthlyRentInCents: operatorContractVersion.monthlyRentInCents,
          revenueShareBasisPoints:
            operatorContractVersion.revenueShareBasisPoints,
          pdfBucket: operatorContractVersion.pdfBucket,
          pdfObjectPath: operatorContractVersion.pdfObjectPath,
          notes: operatorContractVersion.notes,
        })
        .from(operatorContract)
        .innerJoin(
          operatorContractVersion,
          eq(operatorContract.currentVersionId, operatorContractVersion.id),
        )
        .where(and(...conds))
        .orderBy(desc(operatorContract.createdAt));

      return rows.map((r) => ({
        ...r,
        status: r.status as z.infer<typeof contractStatusSchema>,
      }));
    }),

  get: operatorProcedure
    .input(
      orgSlugInput.extend({
        id: z.string().min(1),
      }),
    )
    .output(operatorContractGetOutput)
    .query(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );

      const [c] = await ctx.db
        .select()
        .from(operatorContract)
        .where(
          and(
            eq(operatorContract.id, input.id),
            eq(operatorContract.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!c) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contract not found",
        });
      }
      const versions = await ctx.db
        .select()
        .from(operatorContractVersion)
        .where(eq(operatorContractVersion.entityId, input.id))
        .orderBy(desc(operatorContractVersion.versionNumber));
      return {
        contract: c,
        versions: versions.map((v) => ({
          ...v,
          status: v.status as z.infer<typeof contractStatusSchema>,
        })),
      } as OperatorContractGetOutput;
    }),

  getPdfDownloadUrl: operatorProcedure
    .input(
      z.object({
        orgSlug: z.string().min(1),
        contractId: z.string().min(1),
        versionId: z.string().min(1),
      }),
    )
    .output(z.object({ url: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );
      const [c] = await ctx.db
        .select({ id: operatorContract.id })
        .from(operatorContract)
        .where(
          and(
            eq(operatorContract.id, input.contractId),
            eq(operatorContract.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!c) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contract not found",
        });
      }
      const [v] = await ctx.db
        .select()
        .from(operatorContractVersion)
        .where(
          and(
            eq(operatorContractVersion.id, input.versionId),
            eq(operatorContractVersion.entityId, input.contractId),
          ),
        )
        .limit(1);
      if (!v?.pdfObjectPath) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No PDF uploaded for this version",
        });
      }
      const storage = getProductImageStorage();
      const url = await storage.createSignedDownloadUrl(
        v.pdfObjectPath,
        3600,
      );
      return { url };
    }),
});
