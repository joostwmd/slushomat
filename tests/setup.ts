/**
 * Integration test setup.
 * Sets minimal env vars so @slushomat/env and @slushomat/db don't fail when
 * imported transitively (server → context → db loads connection).
 */
process.env.DATABASE_URL ??= "postgresql://local:local@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-min-32-characters-long!!";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.CORS_ORIGIN_ADMIN ??= "http://localhost:3002";
process.env.CORS_ORIGIN_OPERATOR ??= "http://localhost:3003";
