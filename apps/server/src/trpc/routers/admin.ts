import { randomBytes } from "node:crypto";
import { desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { APIError } from "better-auth";
import { z } from "zod";
import { auth } from "@slushomat/auth";
import { env } from "@slushomat/env/server";
import { organization } from "@slushomat/db/schema";
import { router } from "../init";
import { adminProcedure } from "../procedures";
import { adminBusinessEntityRouter } from "./admin-business-entity";
import { adminCustomerRouter } from "./admin-customer";
import { adminMachineDeploymentRouter } from "./admin-machine-deployment";
import { adminMachineSlotRouter } from "./admin-machine-slot";
import { adminOperatorProductRouter } from "./admin-operator-product";
import { adminPurchaseRouter } from "./admin-purchase";
import {
  machineAdminRouter,
  machineVersionAdminRouter,
} from "./admin-machines";
import { adminOperatorContractRouter } from "./admin-operator-contract";
import { templateProductAdminRouter } from "./admin-template-products";

const createOrganizationInput = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  logo: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  userId: z.string().min(1, "Valid user ID required"),
});

const createOrganizationOutput = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable().optional(),
  metadata: z.unknown().optional(),
  createdAt: z.date(),
});

/** Unambiguous charset (no 0/O, 1/l/I). Min length satisfied vs Better Auth defaults (typically 8). */
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateSecureRandomPassword(length = 24): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PASSWORD_ALPHABET[bytes[i]! % PASSWORD_ALPHABET.length]!;
  }
  return out;
}

const generateUserPasswordInput = z.object({
  userId: z.string().min(1),
});

const generateUserPasswordOutput = z.object({
  password: z.string(),
});

const organizationSummary = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

const createOperatorHandoffTokenInput = z.object({
  userId: z.string().min(1),
});

const createOperatorHandoffTokenOutput = z.object({
  token: z.string(),
});

function parseCookieHeader(cookieHeader: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader.trim()) return map;
  for (const part of cookieHeader.split(";")) {
    const p = part.trim();
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    map.set(p.slice(0, eq), p.slice(eq + 1));
  }
  return map;
}

function applySetCookiesToCookieHeader(
  previousCookieHeader: string,
  setCookieHeaders: string[],
): string {
  const map = parseCookieHeader(previousCookieHeader);
  for (const sc of setCookieHeaders) {
    const first = sc.split(";")[0]?.trim();
    if (!first?.includes("=")) continue;
    const eq = first.indexOf("=");
    const name = first.slice(0, eq);
    const value = first.slice(eq + 1);
    const lower = sc.toLowerCase();
    const deleting =
      lower.includes("max-age=0") || lower.includes("expires=thu, 01 jan 1970");
    if (deleting) {
      map.delete(name);
    } else {
      map.set(name, value);
    }
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function getSetCookieList(res: Response): string[] {
  const h = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === "function") {
    return h.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

async function readAuthErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    const parsed = JSON.parse(text) as { message?: string };
    if (typeof parsed.message === "string") return parsed.message;
    return text.slice(0, 200);
  } catch {
    return res.statusText || "Request failed";
  }
}

/**
 * `BETTER_AUTH_URL` is the API origin; Better Auth defaults `basePath` to `/api/auth`
 * (see `packages/auth` — we do not override `basePath`). Hono mounts `auth.handler` at
 * `/api/auth/*`, so in-process `Request` URLs must include `/api/auth`.
 */
function getAuthApiRoot(): string {
  const trimmed = env.BETTER_AUTH_URL.replace(/\/+$/, "");
  if (trimmed.endsWith("/api/auth")) {
    return trimmed;
  }
  return `${trimmed}/api/auth`;
}

export const adminRouter = router({
  machineVersion: machineVersionAdminRouter,
  machine: machineAdminRouter,
  templateProduct: templateProductAdminRouter,
  businessEntity: adminBusinessEntityRouter,
  customer: adminCustomerRouter,
  purchase: adminPurchaseRouter,
  operatorProduct: adminOperatorProductRouter,
  machineSlot: adminMachineSlotRouter,
  operatorContract: adminOperatorContractRouter,
  machineDeployment: adminMachineDeploymentRouter,
  /** For org pickers (businesses, contracts, deployments). */
  listOrganizations: adminProcedure
    .output(z.array(organizationSummary))
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        })
        .from(organization)
        .orderBy(desc(organization.createdAt));
      return rows;
    }),
  me: adminProcedure.query(({ ctx }) => ({
    user: ctx.user,
    message: "Admin access granted",
  })),

  /**
   * Server-side impersonation + one-time token so the admin browser keeps its admin session.
   * Client-side impersonate → OTT → stopImpersonating breaks handoff: stop deletes the session
   * the token points at, and tRPC does not apply Set-Cookie from auth.api impersonate.
   */
  createOperatorHandoffToken: adminProcedure
    .input(createOperatorHandoffTokenInput)
    .output(createOperatorHandoffTokenOutput)
    .mutation(async ({ ctx, input }) => {
      const authRoot = getAuthApiRoot();
      const origin =
        ctx.headers.get("origin") ?? env.CORS_ORIGIN_ADMIN;
      const adminCookie = ctx.headers.get("cookie") ?? "";

      const forwardHeaders = new Headers();
      if (adminCookie) forwardHeaders.set("cookie", adminCookie);
      forwardHeaders.set("origin", origin);
      const ua = ctx.headers.get("user-agent");
      if (ua) forwardHeaders.set("user-agent", ua);
      forwardHeaders.set("content-type", "application/json");

      let impRes: Response;
      try {
        impRes = await auth.handler(
          new Request(`${authRoot}/admin/impersonate-user`, {
            method: "POST",
            headers: forwardHeaders,
            body: JSON.stringify({ userId: input.userId }),
          }),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: msg || "Impersonation request failed",
          cause: err,
        });
      }

      if (!impRes.ok) {
        const msg = await readAuthErrorMessage(impRes);
        const lower = msg.toLowerCase();
        if (impRes.status === 403 || lower.includes("not allowed")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: msg || "Cannot impersonate this user",
          });
        }
        if (impRes.status === 404 || lower.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: msg || "User not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: msg || "Impersonation failed",
        });
      }

      const afterImpersonateCookie = applySetCookiesToCookieHeader(
        adminCookie,
        getSetCookieList(impRes),
      );

      const genHeaders = new Headers();
      genHeaders.set("cookie", afterImpersonateCookie);
      genHeaders.set("origin", origin);
      if (ua) genHeaders.set("user-agent", ua);

      let genRes: Response;
      try {
        genRes = await auth.handler(
          new Request(`${authRoot}/one-time-token/generate`, {
            method: "GET",
            headers: genHeaders,
          }),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: msg || "Handoff token request failed",
          cause: err,
        });
      }

      if (!genRes.ok) {
        const msg = await readAuthErrorMessage(genRes);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: msg || "Failed to create handoff token",
        });
      }

      const genJson = (await genRes.json()) as { token?: string };
      if (!genJson.token || typeof genJson.token !== "string") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Auth did not return a handoff token",
        });
      }

      return { token: genJson.token };
    }),

  createOrganization: adminProcedure
    .input(createOrganizationInput)
    .output(createOrganizationOutput)
    .mutation(async ({ input }) => {
      try {
        const result = await auth.api.createOrganization({
          body: {
            name: input.name,
            slug: input.slug,
            logo: input.logo,
            metadata: input.metadata,
            userId: input.userId,
            keepCurrentActiveOrganization: false,
          },
        });

        const createdAt =
          result.createdAt instanceof Date
            ? result.createdAt
            : new Date((result.createdAt as string) ?? Date.now());

        return {
          id: result.id,
          name: result.name,
          slug: result.slug,
          logo: result.logo ?? null,
          metadata: result.metadata,
          createdAt,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        const lower = message.toLowerCase();

        if (lower.includes("slug") || lower.includes("duplicate") || lower.includes("unique")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Slug already exists",
            cause: err,
          });
        }
        if (lower.includes("user") || lower.includes("not found") || lower.includes("invalid")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User not found",
            cause: err,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create organization",
          cause: err,
        });
      }
    }),
  generateUserPassword: adminProcedure
    .input(generateUserPasswordInput)
    .output(generateUserPasswordOutput)
    .mutation(async ({ input, ctx }) => {
      // Avoid overwriting your own password via this flow (easy mis-click in admin UI).
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot set a generated password for your own account",
        });
      }

      const newPassword = generateSecureRandomPassword(24);

      try {
        await auth.api.setUserPassword({
          body: { userId: input.userId, newPassword },
          headers: ctx.headers,
        });
        return { password: newPassword };
      } catch (err) {
        if (err instanceof APIError) {
          const message =
            (typeof err.body?.message === "string" && err.body.message) ||
            err.message ||
            "";
          switch (err.status) {
            case "FORBIDDEN":
              throw new TRPCError({
                code: "FORBIDDEN",
                message: message || "Not allowed to set this user's password",
                cause: err,
              });
            case "NOT_FOUND":
              throw new TRPCError({
                code: "NOT_FOUND",
                message: message || "User not found",
                cause: err,
              });
            case "BAD_REQUEST":
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: message || "Invalid password or user",
                cause: err,
              });
            default:
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to set user password",
                cause: err,
              });
          }
        }

        const message =
          err instanceof Error ? err.message : String(err);
        const lower = message.toLowerCase();

        if (lower.includes("forbidden") || lower.includes("not allowed")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not allowed to set this user's password",
            cause: err,
          });
        }
        if (lower.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
            cause: err,
          });
        }
        if (
          lower.includes("invalid") ||
          lower.includes("bad request") ||
          lower.includes("too short") ||
          lower.includes("too long")
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: message || "Invalid request",
            cause: err,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to set user password",
          cause: err,
        });
      }
    }),
});
