/**
 * Integration tests IT-11, IT-12: Full create-customer flow (step 1 → step 2).
 * Simulates step 1 by inserting user directly; tests createOrganization (T02).
 *
 * Traceable: 02-test-spec.md, AC-1, AC-4
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb } from "../_fixtures/db";
import { createTestCaller } from "../_utils/trpc";
import { user, organization, member } from "@slushomat/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

describe("create-customer flow (IT-11, IT-12)", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  let adminUserId: string;

  beforeAll(async () => {
    testDb = await createTestDb();

    adminUserId = randomUUID();
    await testDb.db.insert(user).values({
      id: adminUserId,
      email: `admin-flow-${Date.now()}@test.example.com`,
      name: "Test Admin",
      role: "admin",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  function uniqueSlug() {
    return `flow-org-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function uniqueEmail() {
    return `flow-user-${Date.now()}@example.com`;
  }

  it("IT-11: step 1 (user) + step 2 (org) both succeed, user is org member", async () => {
    // Simulate step 1 success: user created (in real flow, createUser API does this)
    const newUserId = randomUUID();
    await testDb.db.insert(user).values({
      id: newUserId,
      email: uniqueEmail(),
      name: "Flow Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = await createTestCaller({
      db: testDb.db,
      userId: adminUserId,
    });

    const orgResult = await (caller.admin as { createOrganization?: (opts: unknown) => Promise<unknown> }).createOrganization?.({
      name: "Flow Test Org",
      slug: uniqueSlug(),
      userId: newUserId,
    });

    expect(orgResult).toBeDefined();

    const members = await testDb.db
      .select()
      .from(member)
      .where(eq(member.userId, newUserId));
    expect(members.length).toBeGreaterThan(0);
    expect(members[0].organizationId).toBe((orgResult as { id: string }).id);
  });

  it("IT-12: step 2 retry after duplicate slug succeeds with new slug", async () => {
    const newUserId = randomUUID();
    await testDb.db.insert(user).values({
      id: newUserId,
      email: uniqueEmail(),
      name: "Retry User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const duplicateSlug = uniqueSlug();
    await testDb.db.insert(organization).values({
      id: randomUUID(),
      name: "Existing",
      slug: duplicateSlug,
      createdAt: new Date(),
    });

    const caller = await createTestCaller({
      db: testDb.db,
      userId: adminUserId,
    });

    const createOrg = (caller.admin as { createOrganization?: (opts: unknown) => Promise<unknown> }).createOrganization;

    await expect(
      createOrg?.({
        name: "New Org",
        slug: duplicateSlug,
        userId: newUserId,
      }),
    ).rejects.toThrow();

    const newSlug = uniqueSlug();
    const result = await createOrg?.({
      name: "New Org",
      slug: newSlug,
      userId: newUserId,
    });

    expect(result).toBeDefined();
    const orgs = await testDb.db.select().from(organization).where(eq(organization.slug, newSlug));
    expect(orgs).toHaveLength(1);
  });
});
