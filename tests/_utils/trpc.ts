/**
 * tRPC createTestCaller for integration tests.
 * Injects PGlite db and optional admin session.
 *
 * Traceable: T01, 02-test-spec.md, Implementation Reference
 */
import { appRouter } from "server/trpc/router";
import type { Context } from "server/trpc/context";
import { createCallerFactory } from "server/trpc/init";
import type { TestDb } from "../_fixtures/db";

export type AdminSession = {
  user: { id: string; email: string; name: string; role: string };
  session: { id: string; userId: string; token: string };
};

const createCaller = createCallerFactory(appRouter);

/**
 * Creates a tRPC caller for testing with injected db and optional auth.
 * - db: from createTestDb()
 * - userId: admin user id for admin procedures (creates mock session)
 */
export async function createTestCaller(opts: {
  db: TestDb["db"];
  userId?: string;
  user?: AdminSession["user"];
}): Promise<ReturnType<typeof createCaller>> {
  const { db, userId, user } = opts;

  const mockSession = userId
    ? {
        id: `session-${userId}`,
        userId,
        token: `token-${userId}`,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        impersonatedBy: null,
        activeOrganizationId: null,
      }
    : null;

  const mockUser =
    user ??
    (userId
      ? {
          id: userId,
          email: "admin@test.example.com",
          name: "Test Admin",
          role: "admin" as const,
          image: null,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          banned: false,
          banReason: null,
          banExpires: null,
        }
      : null);

  const ctx: Context = {
    db,
    session: mockSession
      ? {
          ...mockSession,
          user: mockUser!,
        }
      : null,
    user: mockUser ?? undefined,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      child: () => ({
        info: () => {},
        warn: () => {},
        error: () => {},
        child: () => ({}),
      }),
    } as Context["logger"],
    requestId: `req-${Date.now()}`,
    headers: new Headers(),
  };

  return createCaller(ctx);
}
