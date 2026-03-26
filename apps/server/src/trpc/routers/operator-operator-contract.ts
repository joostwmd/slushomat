import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import {
  document,
  operatorContract,
  operatorContractVersion,
  operatorMachine,
} from "@slushomat/db/schema";
import { getProductImageStorage } from "../../lib/contract-pdf";
import {
  assertUserMemberOfOrg,
  getOperatorIdForSlug,
} from "../../lib/org-scope";
import { router } from "../init";
import { operatorProcedure } from "../procedures";

const CONTRACT_VERSION_ENTITY_TYPE = "operator_contract_version" as const;

const contractStatusSchema = z.enum(["draft", "active", "terminated"]);

const orgSlugInput = z.object({
  orgSlug: z.string().min(1),
});

const versionShape = z.object({
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
});

const operatorContractGetOutput = z.object({
  contract: z.object({
    id: z.string(),
    operatorId: z.string(),
    businessEntityId: z.string(),
    operatorMachineId: z.string(),
    currentVersionId: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
  versions: z.array(versionShape),
});

type OperatorContractGetOutput = z.infer<typeof operatorContractGetOutput>;

const contractListItemSchema = z.object({
  id: z.string(),
  operatorId: z.string(),
  businessEntityId: z.string(),
  operatorMachineId: z.string(),
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
  const operatorId = await getOperatorIdForSlug(ctx.db, orgSlug);
  await assertUserMemberOfOrg(ctx.db, ctx.user.id, operatorId);
  return operatorId;
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
      const operatorId = await resolveOrgWithMembership(ctx, input.orgSlug);

      const conds = [eq(operatorContract.operatorId, operatorId)];
      if (input.machineId) {
        conds.push(eq(operatorMachine.machineId, input.machineId));
      }

      const rows = await ctx.db
        .select({
          id: operatorContract.id,
          operatorId: operatorContract.operatorId,
          businessEntityId: operatorContract.businessEntityId,
          operatorMachineId: operatorContract.operatorMachineId,
          machineId: operatorMachine.machineId,
          currentVersionId: operatorContract.currentVersionId,
          createdAt: operatorContract.createdAt,
          updatedAt: operatorContract.updatedAt,
          status: operatorContractVersion.status,
          effectiveDate: operatorContractVersion.effectiveDate,
          endedAt: operatorContractVersion.endedAt,
          monthlyRentInCents: operatorContractVersion.monthlyRentInCents,
          revenueShareBasisPoints:
            operatorContractVersion.revenueShareBasisPoints,
          pdfBucket: document.bucket,
          pdfObjectPath: document.objectPath,
          notes: operatorContractVersion.notes,
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
        .leftJoin(
          document,
          and(
            eq(document.entityId, operatorContractVersion.id),
            eq(document.entityType, CONTRACT_VERSION_ENTITY_TYPE),
            eq(document.kind, "contract"),
          ),
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
      const operatorId = await resolveOrgWithMembership(ctx, input.orgSlug);

      const [c] = await ctx.db
        .select()
        .from(operatorContract)
        .where(
          and(
            eq(operatorContract.id, input.id),
            eq(operatorContract.operatorId, operatorId),
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
        .select({
          id: operatorContractVersion.id,
          entityId: operatorContractVersion.entityId,
          versionNumber: operatorContractVersion.versionNumber,
          status: operatorContractVersion.status,
          effectiveDate: operatorContractVersion.effectiveDate,
          endedAt: operatorContractVersion.endedAt,
          monthlyRentInCents: operatorContractVersion.monthlyRentInCents,
          revenueShareBasisPoints:
            operatorContractVersion.revenueShareBasisPoints,
          notes: operatorContractVersion.notes,
          createdAt: operatorContractVersion.createdAt,
          pdfBucket: document.bucket,
          pdfObjectPath: document.objectPath,
        })
        .from(operatorContractVersion)
        .leftJoin(
          document,
          and(
            eq(document.entityId, operatorContractVersion.id),
            eq(document.entityType, CONTRACT_VERSION_ENTITY_TYPE),
            eq(document.kind, "contract"),
          ),
        )
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
      const operatorId = await resolveOrgWithMembership(
        ctx,
        input.orgSlug,
      );
      const [c] = await ctx.db
        .select({ id: operatorContract.id })
        .from(operatorContract)
        .where(
          and(
            eq(operatorContract.id, input.contractId),
            eq(operatorContract.operatorId, operatorId),
          ),
        )
        .limit(1);
      if (!c) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contract not found",
        });
      }
      const [docRow] = await ctx.db
        .select({
          objectPath: document.objectPath,
        })
        .from(document)
        .where(
          and(
            eq(document.entityId, input.versionId),
            eq(document.entityType, CONTRACT_VERSION_ENTITY_TYPE),
            eq(document.kind, "contract"),
          ),
        )
        .limit(1);
      if (!docRow?.objectPath) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No PDF uploaded for this version",
        });
      }
      const storage = getProductImageStorage();
      const url = await storage.createSignedDownloadUrl(
        docRow.objectPath,
        3600,
      );
      return { url };
    }),
});
