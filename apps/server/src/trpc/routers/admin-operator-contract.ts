import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, max } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import {
  document,
  machine,
  operatorContract,
  operatorContractChange,
  operatorContractVersion,
  operatorMachine,
  operatorMachineDisplayName,
} from "@slushomat/db/schema";
import {
  CONTRACT_PDF_MAX_BYTES,
  createContractPdfUploadPath,
  getProductImageStorage,
  pathPrefixOperatorContractVersion,
} from "../../lib/contract-pdf";
import {
  assertAtMostOneActiveContractForMachine,
  assertBusinessEntityBelongsToOperator,
} from "../../lib/machine-lifecycle";
import { ensureOperatorMachineDisplayNames } from "../../lib/operator-machine-display-name";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const CONTRACT_VERSION_ENTITY_TYPE = "operator_contract_version" as const;

const contractStatusSchema = z.enum(["draft", "active", "terminated"]);

const versionPayloadSchema = z.object({
  status: contractStatusSchema,
  effectiveDate: z.date(),
  endedAt: z.date().nullable().optional(),
  monthlyRentInCents: z.number().int().nonnegative(),
  revenueShareBasisPoints: z.number().int().min(0).max(10000),
  notes: z.string().nullable().optional(),
});

const versionOutputFields = z.object({
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
  versions: z.array(versionOutputFields),
});

type OperatorContractGetOutput = z.infer<typeof operatorContractGetOutput>;

const contractListItemSchema = z.object({
  id: z.string(),
  operatorId: z.string(),
  businessEntityId: z.string(),
  operatorMachineId: z.string(),
  machineId: z.string(),
  machineInternalName: z.string(),
  machineOrgDisplayName: z.string().nullable(),
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

async function requireContractForOperator(
  dbClient: typeof db,
  contractId: string,
  operatorId: string,
) {
  const [row] = await dbClient
    .select()
    .from(operatorContract)
    .where(
      and(
        eq(operatorContract.id, contractId),
        eq(operatorContract.operatorId, operatorId),
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

async function getOpenOperatorMachineForTriple(
  dbClient: typeof db,
  operatorId: string,
  machineId: string,
  businessEntityId: string,
) {
  const [row] = await dbClient
    .select({ id: operatorMachine.id })
    .from(operatorMachine)
    .where(
      and(
        eq(operatorMachine.operatorId, operatorId),
        eq(operatorMachine.machineId, machineId),
        eq(operatorMachine.businessEntityId, businessEntityId),
        isNull(operatorMachine.undeployedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export const adminOperatorContractRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          operatorId: z.string().optional(),
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
      if (input.operatorId) {
        conds.push(eq(operatorContract.operatorId, input.operatorId));
      }
      if (input.machineId) {
        conds.push(eq(operatorMachine.machineId, input.machineId));
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
          operatorId: operatorContract.operatorId,
          businessEntityId: operatorContract.businessEntityId,
          operatorMachineId: operatorContract.operatorMachineId,
          machineId: operatorMachine.machineId,
          machineInternalName: machine.internalName,
          machineOrgDisplayName: operatorMachineDisplayName.orgDisplayName,
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
          operatorContractVersion,
          eq(operatorContract.currentVersionId, operatorContractVersion.id),
        )
        .innerJoin(
          operatorMachine,
          eq(operatorContract.operatorMachineId, operatorMachine.id),
        )
        .innerJoin(machine, eq(operatorMachine.machineId, machine.id))
        .leftJoin(
          document,
          and(
            eq(document.entityId, operatorContractVersion.id),
            eq(document.entityType, CONTRACT_VERSION_ENTITY_TYPE),
            eq(document.kind, "contract"),
          ),
        )
        .leftJoin(
          operatorMachineDisplayName,
          and(
            eq(
              operatorMachineDisplayName.operatorId,
              operatorContract.operatorId,
            ),
            eq(
              operatorMachineDisplayName.machineId,
              operatorMachine.machineId,
            ),
          ),
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

  create: adminProcedure
    .input(
      z.object({
        operatorId: z.string().min(1),
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
      await assertBusinessEntityBelongsToOperator(
        ctx.db,
        input.businessEntityId,
        input.operatorId,
      );
      await requireMachine(ctx.db, input.machineId);

      const openOm = await getOpenOperatorMachineForTriple(
        ctx.db,
        input.operatorId,
        input.machineId,
        input.businessEntityId,
      );
      if (!openOm) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "No open machine assignment for this operator, machine, and business entity. Start a deployment first.",
        });
      }

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
          operatorId: input.operatorId,
          businessEntityId: input.businessEntityId,
          operatorMachineId: openOm.id,
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

        await ensureOperatorMachineDisplayNames(tx, input.operatorId, [
          input.machineId,
        ]);
      });

      return { contractId: baseId, versionId };
    }),

  addVersion: adminProcedure
    .input(
      z.object({
        contractId: z.string().min(1),
        operatorId: z.string().min(1),
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
      const contract = await requireContractForOperator(
        ctx.db,
        input.contractId,
        input.operatorId,
      );

      const [om] = await ctx.db
        .select({ machineId: operatorMachine.machineId })
        .from(operatorMachine)
        .where(eq(operatorMachine.id, contract.operatorMachineId))
        .limit(1);

      if (input.version.status === "active" && om) {
        await assertAtMostOneActiveContractForMachine(
          ctx.db,
          om.machineId,
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
        operatorId: z.string().min(1),
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
      await requireContractForOperator(
        ctx.db,
        input.contractId,
        input.operatorId,
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
        operatorId: z.string().min(1),
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
      await requireContractForOperator(
        ctx.db,
        input.contractId,
        input.operatorId,
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
      const docId = randomUUID();

      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(document)
          .where(
            and(
              eq(document.entityType, CONTRACT_VERSION_ENTITY_TYPE),
              eq(document.entityId, input.versionId),
              eq(document.kind, "contract"),
            ),
          );

        await tx.insert(document).values({
          id: docId,
          kind: "contract",
          entityType: CONTRACT_VERSION_ENTITY_TYPE,
          entityId: input.versionId,
          bucket,
          objectPath: input.objectPath,
        });
      });

      return { bucket, objectPath: input.objectPath };
    }),
});
