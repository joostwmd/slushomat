/**
 * Session shape for model-factory repositories (Better Auth–compatible).
 * Uses `operatorId` (tenant / Better Auth “organization”).
 */
export interface Session {
  user: { id: string; name: string; email: string };
  operatorId: string;
}

/** Columns managed by factories — callers must not set these on create/update. */
export const SYSTEM_KEYS = [
  "id",
  "entityId",
  "operatorId",
  "userId",
  "versionNumber",
  "currentVersionId",
  "createdAt",
  "updatedAt",
  "deletedAt",
] as const;

export type SystemKey = (typeof SYSTEM_KEYS)[number];

export type OmitSystemKeys<T> = Omit<T, SystemKey>;
