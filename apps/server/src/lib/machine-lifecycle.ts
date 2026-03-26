import { and, eq, isNull, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  businessEntity,
  operatorContract,
  operatorContractVersion,
  operatorMachine,
} from "@slushomat/db/schema";
import type { DbClient } from "./org-scope";

export async function assertBusinessEntityBelongsToOperator(
  dbClient: DbClient,
  entityId: string,
  operatorId: string,
): Promise<void> {
  const [row] = await dbClient
    .select({ id: businessEntity.id })
    .from(businessEntity)
    .where(
      and(
        eq(businessEntity.id, entityId),
        eq(businessEntity.operatorId, operatorId),
        isNull(businessEntity.deletedAt),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Business entity not found for this operator",
    });
  }
}

/** @deprecated Use {@link assertBusinessEntityBelongsToOperator} */
export const assertBusinessEntityBelongsToOrg =
  assertBusinessEntityBelongsToOperator;

export async function getOpenOperatorMachineForMachine(
  dbClient: DbClient,
  machineId: string,
): Promise<typeof operatorMachine.$inferSelect | null> {
  const [row] = await dbClient
    .select()
    .from(operatorMachine)
    .where(
      and(
        eq(operatorMachine.machineId, machineId),
        isNull(operatorMachine.undeployedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** @deprecated Use {@link getOpenOperatorMachineForMachine} */
export const getOpenDeploymentForMachine = getOpenOperatorMachineForMachine;

/**
 * Throws CONFLICT if another contract for this machine already has an **active** current version.
 */
export async function assertAtMostOneActiveContractForMachine(
  dbClient: DbClient,
  machineId: string,
  excludeContractBaseId?: string,
): Promise<void> {
  const conditions = [
    eq(operatorMachine.machineId, machineId),
    eq(operatorContractVersion.status, "active"),
  ];
  if (excludeContractBaseId) {
    conditions.push(ne(operatorContract.id, excludeContractBaseId));
  }

  const rows = await dbClient
    .select({ id: operatorContract.id })
    .from(operatorContract)
    .innerJoin(
      operatorMachine,
      eq(operatorContract.operatorMachineId, operatorMachine.id),
    )
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
