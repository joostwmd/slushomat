/**
 * Session shape for model-factory repositories (Better Auth–compatible).
 * Uses `organizationId` (Slushomat naming), not `organisationId`.
 */
export interface Session {
  user: { id: string; name: string; email: string };
  organizationId: string;
}

/** Columns managed by factories — callers must not set these on create/update. */
export const SYSTEM_KEYS = [
  "id",
  "entityId",
  "organizationId",
  "userId",
  "versionNumber",
  "currentVersionId",
  "createdAt",
  "updatedAt",
  "deletedAt",
] as const;

export type SystemKey = (typeof SYSTEM_KEYS)[number];

export type OmitSystemKeys<T> = Omit<T, SystemKey>;
