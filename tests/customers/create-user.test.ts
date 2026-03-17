/**
 * Integration tests IT-01–IT-04: createUser via Better Auth HTTP.
 *
 * These require a running server or auth.api with testUtils.
 * Structure in place; full implementation needs:
 * - Better Auth testUtils plugin in auth config
 * - PGlite-backed auth for tests
 * - HTTP client to call /api/auth/admin/create-user or equivalent
 *
 * Traceable: 02-test-spec.md, AC-1, AC-2, AC-5, AC-6, Auth
 */
import { describe, it, expect } from "vitest";

describe("createUser (IT-01–IT-04)", () => {
  it.skip("IT-01: admin creates user with valid email, password, name", async () => {
    // Requires: Better Auth testUtils, admin session, HTTP call to createUser
    // authClient.admin.createUser({ email, password, name, role: "user" })
    expect(true).toBe(true);
  });

  it.skip("IT-02: rejects duplicate email", async () => {
    expect(true).toBe(true);
  });

  it.skip("IT-03: returns validation error for missing required fields", async () => {
    expect(true).toBe(true);
  });

  it.skip("IT-04: rejects non-admin (401/403)", async () => {
    expect(true).toBe(true);
  });
});
