/**
 * PGlite + Drizzle test database fixture.
 * Uses in-memory Postgres for isolated integration tests.
 *
 * Traceable: T01, 02-test-spec.md §8
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "@slushomat/db/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/**
 * Creates an in-memory PGlite database with schema migrated.
 * One instance per test file (use in beforeAll).
 */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await migrate(db, {
    migrationsFolder: path.resolve(
      __dirname,
      "../../packages/db/src/migrations",
    ),
  });

  return { client, db };
}
