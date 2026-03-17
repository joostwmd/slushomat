import { db } from "@slushomat/db";
import * as schema from "@slushomat/db/schema";
import { env } from "@slushomat/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  trustedOrigins: [env.CORS_ORIGIN_ADMIN, env.CORS_ORIGIN_OPERATOR],
  emailAndPassword: {
    enabled: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },
  plugins: [
    admin(),
    organization({
      allowUserToCreateOrganization: async (user) => {
        return user.role === "admin";
      },
    }),
  ],
});
