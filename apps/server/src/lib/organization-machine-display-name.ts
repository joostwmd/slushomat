import { and, eq, inArray } from "drizzle-orm";

import type { db } from "@slushomat/db";
import {
  organization,
  organizationMachineDisplayName,
} from "@slushomat/db/schema";

type DbClient =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export function defaultOrgMachineDisplayName(organizationName: string): string {
  const n = organizationName.trim();
  return n ? `${n} machine` : "machine";
}

/**
 * Ensures each (organization, machine) pair has a row; missing rows get the default "{Org name} machine".
 */
export async function ensureOrganizationMachineDisplayNames(
  dbClient: DbClient,
  organizationId: string,
  machineIds: string[],
): Promise<void> {
  if (machineIds.length === 0) return;

  const existing = await dbClient
    .select({ machineId: organizationMachineDisplayName.machineId })
    .from(organizationMachineDisplayName)
    .where(
      and(
        eq(organizationMachineDisplayName.organizationId, organizationId),
        inArray(organizationMachineDisplayName.machineId, machineIds),
      ),
    );

  const have = new Set(existing.map((r) => r.machineId));
  const missing = machineIds.filter((id) => !have.has(id));
  if (missing.length === 0) return;

  const [org] = await dbClient
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  const label = defaultOrgMachineDisplayName(org?.name ?? "");

  await dbClient
    .insert(organizationMachineDisplayName)
    .values(
      missing.map((machineId) => ({
        organizationId,
        machineId,
        orgDisplayName: label,
      })),
    )
    .onConflictDoNothing({
      target: [
        organizationMachineDisplayName.organizationId,
        organizationMachineDisplayName.machineId,
      ],
    });
}
