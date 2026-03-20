import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { APIError } from "better-auth";
import { z } from "zod";
import { auth } from "@slushomat/auth";
import { router } from "../init";
import { adminProcedure } from "../procedures";
import {
  machineAdminRouter,
  machineVersionAdminRouter,
} from "./admin-machines";
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

export const adminRouter = router({
  machineVersion: machineVersionAdminRouter,
  machine: machineAdminRouter,
  templateProduct: templateProductAdminRouter,
  me: adminProcedure.query(({ ctx }) => ({
    user: ctx.user,
    message: "Admin access granted",
  })),
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
