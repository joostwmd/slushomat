import { db, getInitialOrganization } from "@slushomat/db";
import * as schema from "@slushomat/db/schema";
import { env } from "@slushomat/env/server";
import { apiKey } from "@better-auth/api-key";
import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import { oneTimeToken } from "better-auth/plugins/one-time-token";

import {
  ADMIN_EMAIL_DOMAIN_NOT_ALLOWED_CODE,
  ADMIN_EMAIL_DOMAIN_NOT_ALLOWED_MESSAGE,
} from "./auth-errors";

function normalizeRequestOrigin(url: string): string {
  try {
    return new URL(url).origin.toLowerCase();
  } catch {
    return "";
  }
}

/** Origins derived from the incoming request (Origin, else Referer). */
function requestOrigins(request: Request): string[] {
  const origin = request.headers.get("origin");
  if (origin) return [origin];
  const referer = request.headers.get("referer");
  if (!referer) return [];
  try {
    return [new URL(referer).origin];
  } catch {
    return [];
  }
}

function isAdminAppRequest(request: Request | undefined): boolean {
  if (!request) return false;
  const adminOrigin = normalizeRequestOrigin(env.CORS_ORIGIN_ADMIN);
  return requestOrigins(request).some((o) => normalizeRequestOrigin(o) === adminOrigin);
}

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
      activeOrganizationSlug: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          const path = ctx?.path ?? "";
          if (!path.endsWith("/sign-up/email")) return;
          if (!isAdminAppRequest(ctx?.request)) return;

          const email =
            typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
          if (email.endsWith("@code.berlin")) return;

          throw APIError.from("FORBIDDEN", {
            message: ADMIN_EMAIL_DOMAIN_NOT_ALLOWED_MESSAGE,
            code: ADMIN_EMAIL_DOMAIN_NOT_ALLOWED_CODE,
          });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const org = await getInitialOrganization(session.userId);
          return {
            data: {
              ...session,
              activeOrganizationId: org?.id ?? null,
              activeOrganizationSlug: org?.slug ?? null,
            },
          };
        },
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
    // Single options object (not an array) = one implicit "default" API key profile — same idea as `apiKey()` in the docs, with SLUSH_ + metadata for devices.
    apiKey({
      references: "user",
      enableMetadata: true,
      defaultPrefix: "SLUSH_",
      // Default max name length is 32; we use `machine:<uuid>` (~43 chars) for device keys.
      maximumNameLength: 80,
      // Throttling off for device keys (not related to key expiry).
      rateLimit: { enabled: false, timeWindow: 86_400_000, maxRequests: 1_000_000 },
      // No time-based expiry: expiresAt stays null unless you revoke/delete the key.
      keyExpiration: {
        defaultExpiresIn: null,
        disableCustomExpiresTime: true,
      },
      startingCharactersConfig: { shouldStore: true, charactersLength: 10 },
    }),
  ],
});
