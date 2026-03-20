import { and, eq, isNull, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  businessEntity,
  machineDeployment,
  operatorContract,
  operatorContractVersion,
} from "@slushomat/db/schema";
import type { DbClient } from "./org-scope";

export async function assertBusinessEntityBelongsToOrg(
  dbClient: DbClient,
  entityId: string,
  organizationId: string,
): Promise<void> {
  const [row] = await dbClient
    .select({ id: businessEntity.id })
    .from(businessEntity)
    .where(
      and(
        eq(businessEntity.id, entityId),
        eq(businessEntity.organizationId, organizationId),
        isNull(businessEntity.deletedAt),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Business entity not found for this organization",
    });
  }
}

export async function getOpenDeploymentForMachine(
  dbClient: DbClient,
  machineId: string,
): Promise<typeof machineDeployment.$inferSelect | null> {
  const [row] = await dbClient
    .select()
    .from(machineDeployment)
    .where(
      and(
        eq(machineDeployment.machineId, machineId),
        isNull(machineDeployment.endedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Throws CONFLICT if another contract for this machine already has an **active** current version.
 */
export async function assertAtMostOneActiveContractForMachine(
  dbClient: DbClient,
  machineId: string,
  excludeContractBaseId?: string,
): Promise<void> {
  const conditions = [
    eq(operatorContract.machineId, machineId),
    eq(operatorContractVersion.status, "active"),
  ];
  if (excludeContractBaseId) {
    conditions.push(ne(operatorContract.id, excludeContractBaseId));
  }

  const rows = await dbClient
    .select({ id: operatorContract.id })
    .from(operatorContract)
    .innerJoin(
      operatorContractVersion,
      eq(operatorContract.currentVersionId, operatorContractVersion.id),
    )
    .where(and(...conditions))
    .limit(1);

  if (rows.length > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This machine already has an active contract",
    });
  }
}
