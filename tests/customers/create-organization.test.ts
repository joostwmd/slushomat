/**
 * Integration tests IT-05–IT-10: createOrganization tRPC procedure.
 * Uses createTestCaller + PGlite. Fails until T02 implements the procedure.
 *
 * Traceable: 02-test-spec.md, AC-1, AC-3, AC-4, AC-6, Auth
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb } from "../_fixtures/db";
import { createTestCaller } from "../_utils/trpc";
import { user, organization, member } from "@slushomat/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

describe("createOrganization (IT-05–IT-10)", () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  let adminUserId: string;

  beforeAll(async () => {
    testDb = await createTestDb();

    // Create admin user for auth-gated tests
    adminUserId = randomUUID();
    await testDb.db.insert(user).values({
      id: adminUserId,
      email: `admin-${Date.now()}@test.example.com`,
      name: "Test Admin",
      role: "admin",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  function uniqueSlug() {
    return `test-org-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function uniqueEmail() {
    return `user-${Date.now()}@example.com`;
  }

  it("IT-05: creates organization with valid name, slug, userId and links user as member", async () => {
    const userId = randomUUID();
    await testDb.db.insert(user).values({
      id: userId,
      email: uniqueEmail(),
      name: "Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = await createTestCaller({
      db: testDb.db,
      userId: adminUserId,
    });

    // T02 will add admin.createOrganization — will fail until then
    const result = await (caller.admin as { createOrganization?: (opts: unknown) => Promise<unknown> }).createOrganization?.({
      name: "Test Org",
      slug: uniqueSlug(),
      userId,
    });

    expect(result).toBeDefined();
    expect((result as { id?: string })?.id).toBeDefined();

    const orgs = await testDb.db.select().from(organization).where(eq(organization.slug, (result as { slug: string }).slug));
    expect(orgs).toHaveLength(1);

    const members = await testDb.db.select().from(member).where(eq(member.organizationId, (result as { id: string }).id));
    expect(members.some((m) => m.userId === userId)).toBe(true);
  });

  it("IT-06: accepts optional logo and metadata", async () => {
    const userId = randomUUID();
    await testDb.db.insert(user).values({
      id: userId,
      email: uniqueEmail(),
      name: "Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = await createTestCaller({
      db: testDb.db,
      userId: adminUserId,
    });

    const result = await (caller.admin as { createOrganization?: (opts: unknown) => Promise<unknown> }).createOrganization?.({
      name: "Org With Options",
      slug: uniqueSlug(),
      userId,
      logo: "https://example.com/logo.png",
      metadata: { key: "value" },
    });

    expect(result).toBeDefined();
    const org = await testDb.db.query.organization.findFirst({
      where: eq(organization.id, (result as { id: string }).id),
    });
    expect(org?.logo).toBe("https://example.com/logo.png");
    expect(org?.metadata).toBe('{"key":"value"}');
  });

  it("IT-07: rejects duplicate slug", async () => {
    const slug = uniqueSlug();
    const existingOrgId = randomUUID();
    await testDb.db.insert(organization).values({
      id: existingOrgId,
      name: "Existing Org",
      slug,
      createdAt: new Date(),
    });

    const userId = randomUUID();
    await testDb.db.insert(user).values({
      id: userId,
      email: uniqueEmail(),
      name: "Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = await createTestCaller({
      db: testDb.db,
      userId: adminUserId,
    });

    // Fails with "No procedure" until T02; will assert duplicate error once procedure exists
    await expect(
      (caller.admin as { createOrganization?: (opts: unknown) => Promise<unknown> }).createOrganization?.({ name: "New Org", slug, userId }),
    ).rejects.toThrow();
  });

  it("IT-08: rejects missing required fields (name, slug)", async () => {
    const caller = await createTestCaller({
      db: testDb.db,
      userId: adminUserId,
    });

    const userId = randomUUID();
    await expect(
      (caller.admin as { createOrganization?: (opts: unknown) => Promise<unknown> }).createOrganization?.({
        name: "",
        slug: "",
        userId,
      }),
    ).rejects.toThrow();
  });

  it("IT-09: returns error for non-existent userId", async () => {
    const caller = await createTestCaller({
      db: testDb.db,
      userId: adminUserId,
    });

    const fakeUserId = randomUUID();

    await expect(
      (caller.admin as { createOrganization?: (opts: unknown) => Promise<unknown> }).createOrganization?.({
        name: "Org",
        slug: uniqueSlug(),
        userId: fakeUserId,
      }),
    ).rejects.toThrow();
  });

  it("IT-10: rejects non-admin (no session)", async () => {
    const caller = await createTestCaller({
      db: testDb.db,
      // no userId — no session
    });

    const userId = randomUUID();
    await testDb.db.insert(user).values({
      id: userId,
      email: uniqueEmail(),
      name: "Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      (caller.admin as { createOrganization?: (opts: unknown) => Promise<unknown> }).createOrganization?.({
        name: "Org",
        slug: uniqueSlug(),
        userId,
      }),
    ).rejects.toThrow(/unauthorized|forbidden|admin|authentication required/i);
  });
});
