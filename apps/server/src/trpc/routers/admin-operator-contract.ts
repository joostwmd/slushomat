import { randomUUID } from "node:crypto";
import { and, desc, eq, max } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import { machine } from "@slushomat/db/schema";
import {
  operatorContract,
  operatorContractChange,
  operatorContractVersion,
} from "@slushomat/db/schema";
import {
  CONTRACT_PDF_MAX_BYTES,
  createContractPdfUploadPath,
  getProductImageStorage,
  pathPrefixOperatorContractVersion,
} from "../../lib/contract-pdf";
import {
  assertAtMostOneActiveContractForMachine,
  assertBusinessEntityBelongsToOrg,
} from "../../lib/machine-lifecycle";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const contractStatusSchema = z.enum(["draft", "active", "terminated"]);

const versionPayloadSchema = z.object({
  status: contractStatusSchema,
  effectiveDate: z.date(),
  endedAt: z.date().nullable().optional(),
  monthlyRentInCents: z.number().int().nonnegative(),
  revenueShareBasisPoints: z.number().int().min(0).max(10000),
  notes: z.string().nullable().optional(),
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

async function requireMachine(dbClient: typeof db, machineId: string) {
  const [row] = await dbClient
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

async function requireContractForOrg(
  dbClient: typeof db,
  contractId: string,
  organizationId: string,
) {
  const [row] = await dbClient
    .select()
    .from(operatorContract)
    .where(
      and(
        eq(operatorContract.id, contractId),
        eq(operatorContract.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Contract not found",
    });
  }
  return row;
}

async function requireContractVersion(
  dbClient: typeof db,
  contractId: string,
  versionId: string,
) {
  const [row] = await dbClient
    .select()
    .from(operatorContractVersion)
    .where(
      and(
        eq(operatorContractVersion.id, versionId),
        eq(operatorContractVersion.entityId, contractId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Contract version not found",
    });
  }
  return row;
}

export const adminOperatorContractRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          organizationId: z.string().optional(),
          machineId: z.string().optional(),
          businessEntityId: z.string().optional(),
          status: contractStatusSchema.optional(),
        })
        .optional()
        .default({}),
    )
    .output(z.array(contractListItemSchema))
    .query(async ({ ctx, input }) => {
      const conds = [];
      if (input.organizationId) {
        conds.push(eq(operatorContract.organizationId, input.organizationId));
      }
      if (input.machineId) {
        conds.push(eq(operatorContract.machineId, input.machineId));
      }
      if (input.businessEntityId) {
        conds.push(
          eq(operatorContract.businessEntityId, input.businessEntityId),
        );
      }
      if (input.status) {
        conds.push(eq(operatorContractVersion.status, input.status));
      }

      const q = ctx.db
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
        );

      const rows =
        conds.length > 0
          ? await q.where(and(...conds)).orderBy(desc(operatorContract.createdAt))
          : await q.orderBy(desc(operatorContract.createdAt));

      return rows.map((r) => ({
        ...r,
        status: r.status as z.infer<typeof contractStatusSchema>,
      }));
    }),

  get: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .output(operatorContractGetOutput)
    .query(async ({ ctx, input }) => {
      const [c] = await ctx.db
        .select()
        .from(operatorContract)
        .where(eq(operatorContract.id, input.id))
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

  create: adminProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        businessEntityId: z.string().min(1),
        machineId: z.string().min(1),
        version: versionPayloadSchema,
      }),
    )
    .output(
      z.object({
        contractId: z.string(),
        versionId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertBusinessEntityBelongsToOrg(
        ctx.db,
        input.businessEntityId,
        input.organizationId,
      );
      await requireMachine(ctx.db, input.machineId);

      if (input.version.status === "active") {
        await assertAtMostOneActiveContractForMachine(
          ctx.db,
          input.machineId,
        );
      }

      const baseId = randomUUID();
      const versionId = randomUUID();
      const changeId = randomUUID();
      const actor = ctx.user;

      await ctx.db.transaction(async (tx) => {
        await tx.insert(operatorContract).values({
          id: baseId,
          organizationId: input.organizationId,
          businessEntityId: input.businessEntityId,
          machineId: input.machineId,
          currentVersionId: null,
        });

        await tx.insert(operatorContractVersion).values({
          id: versionId,
          entityId: baseId,
          versionNumber: 1,
          status: input.version.status,
          effectiveDate: input.version.effectiveDate,
          endedAt: input.version.endedAt ?? null,
          monthlyRentInCents: input.version.monthlyRentInCents,
          revenueShareBasisPoints: input.version.revenueShareBasisPoints,
          notes: input.version.notes ?? null,
        });

        await tx.insert(operatorContractChange).values({
          id: changeId,
          entityId: baseId,
          versionId,
          action: "create",
          actorUserId: actor.id,
          actorUserName: actor.name ?? "",
          actorUserEmail: actor.email ?? "",
        });

        await tx
          .update(operatorContract)
          .set({ currentVersionId: versionId })
          .where(eq(operatorContract.id, baseId));
      });

      return { contractId: baseId, versionId };
    }),

  addVersion: adminProcedure
    .input(
      z.object({
        contractId: z.string().min(1),
        organizationId: z.string().min(1),
        version: versionPayloadSchema,
      }),
    )
    .output(
      z.object({
        versionId: z.string(),
        versionNumber: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const contract = await requireContractForOrg(
        ctx.db,
        input.contractId,
        input.organizationId,
      );

      if (input.version.status === "active") {
        await assertAtMostOneActiveContractForMachine(
          ctx.db,
          contract.machineId,
          input.contractId,
        );
      }

      const maxRow = await ctx.db
        .select({ maxNum: max(operatorContractVersion.versionNumber) })
        .from(operatorContractVersion)
        .where(eq(operatorContractVersion.entityId, input.contractId));

      const nextVersion = (maxRow[0]?.maxNum ?? 0) + 1;
      const versionId = randomUUID();
      const changeId = randomUUID();
      const actor = ctx.user;

      await ctx.db.transaction(async (tx) => {
        await tx.insert(operatorContractVersion).values({
          id: versionId,
          entityId: input.contractId,
          versionNumber: nextVersion,
          status: input.version.status,
          effectiveDate: input.version.effectiveDate,
          endedAt: input.version.endedAt ?? null,
          monthlyRentInCents: input.version.monthlyRentInCents,
          revenueShareBasisPoints: input.version.revenueShareBasisPoints,
          notes: input.version.notes ?? null,
        });

        await tx.insert(operatorContractChange).values({
          id: changeId,
          entityId: input.contractId,
          versionId,
          action: "update",
          actorUserId: actor.id,
          actorUserName: actor.name ?? "",
          actorUserEmail: actor.email ?? "",
        });

        await tx
          .update(operatorContract)
          .set({ currentVersionId: versionId })
          .where(eq(operatorContract.id, input.contractId));
      });

      return { versionId, versionNumber: nextVersion };
    }),

  requestPdfUpload: adminProcedure
    .input(
      z.object({
        contractId: z.string().min(1),
        versionId: z.string().min(1),
        organizationId: z.string().min(1),
        contentType: z.string().min(1),
        fileSizeBytes: z
          .number()
          .int()
          .positive()
          .max(CONTRACT_PDF_MAX_BYTES),
      }),
    )
    .output(
      z.object({
        bucket: z.string(),
        path: z.string(),
        token: z.string(),
        signedUrl: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireContractForOrg(
        ctx.db,
        input.contractId,
        input.organizationId,
      );
      await requireContractVersion(
        ctx.db,
        input.contractId,
        input.versionId,
      );
      return createContractPdfUploadPath(
        input.contractId,
        input.versionId,
        input.contentType,
      );
    }),

  confirmPdf: adminProcedure
    .input(
      z.object({
        contractId: z.string().min(1),
        versionId: z.string().min(1),
        organizationId: z.string().min(1),
        objectPath: z.string().min(1),
      }),
    )
    .output(
      z.object({
        bucket: z.string(),
        objectPath: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireContractForOrg(
        ctx.db,
        input.contractId,
        input.organizationId,
      );
      await requireContractVersion(
        ctx.db,
        input.contractId,
        input.versionId,
      );

      const storage = getProductImageStorage();
      const prefix = pathPrefixOperatorContractVersion(
        input.contractId,
        input.versionId,
      );
      if (
        !input.objectPath.startsWith(prefix) ||
        input.objectPath.includes("..")
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid object path",
        });
      }

      const bucket = storage.bucketName;
      await ctx.db
        .update(operatorContractVersion)
        .set({
          pdfBucket: bucket,
          pdfObjectPath: input.objectPath,
        })
        .where(eq(operatorContractVersion.id, input.versionId));

      return { bucket, objectPath: input.objectPath };
    }),
});
