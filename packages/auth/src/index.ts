import { db } from "@slushomat/db";
import * as schema from "@slushomat/db/schema";
import { env } from "@slushomat/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import { oneTimeToken } from "better-auth/plugins/one-time-token";

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
  session: {
    // Admin plugin adds impersonatedBy; ensure it's accepted as session field
    additionalFields: {
      impersonatedBy: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },
  plugins: [
    admin(),
    oneTimeToken(),
    organization({
      allowUserToCreateOrganization: async (user) => {
        return user.role === "admin";
      },
    }),
  ],
});
