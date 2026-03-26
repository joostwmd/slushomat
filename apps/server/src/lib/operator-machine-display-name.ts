import { and, eq, inArray } from "drizzle-orm";

import type { db } from "@slushomat/db";
import { operator, operatorMachineDisplayName } from "@slushomat/db/schema";

type DbClient =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export function defaultOperatorMachineDisplayName(operatorName: string): string {
  const n = operatorName.trim();
  return n ? `${n} machine` : "machine";
}

/**
 * Ensures each (operator, machine) pair has a row; missing rows get the default "{Operator name} machine".
 */
export async function ensureOperatorMachineDisplayNames(
  dbClient: DbClient,
  operatorId: string,
  machineIds: string[],
): Promise<void> {
  if (machineIds.length === 0) return;

  const existing = await dbClient
    .select({ machineId: operatorMachineDisplayName.machineId })
    .from(operatorMachineDisplayName)
    .where(
      and(
        eq(operatorMachineDisplayName.operatorId, operatorId),
        inArray(operatorMachineDisplayName.machineId, machineIds),
      ),
    );

  const have = new Set(existing.map((r) => r.machineId));
  const missing = machineIds.filter((id) => !have.has(id));
  if (missing.length === 0) return;

  const [op] = await dbClient
    .select({ name: operator.name })
    .from(operator)
    .where(eq(operator.id, operatorId))
    .limit(1);

  const label = defaultOperatorMachineDisplayName(op?.name ?? "");

  await dbClient
    .insert(operatorMachineDisplayName)
    .values(
      missing.map((machineId) => ({
        operatorId,
        machineId,
        orgDisplayName: label,
      })),
    )
    .onConflictDoNothing({
      target: [
        operatorMachineDisplayName.operatorId,
        operatorMachineDisplayName.machineId,
      ],
    });
}

/** @deprecated Use {@link ensureOperatorMachineDisplayNames} */
export const ensureOrganizationMachineDisplayNames =
  ensureOperatorMachineDisplayNames;
