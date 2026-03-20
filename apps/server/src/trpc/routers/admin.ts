import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { auth } from "@slushomat/auth";
import { router } from "../init";
import { adminProcedure } from "../procedures";
import {
  machineAdminRouter,
  machineVersionAdminRouter,
} from "./admin-machines";

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

export const adminRouter = router({
  machineVersion: machineVersionAdminRouter,
  machine: machineAdminRouter,
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
          err instanceof Error ? err.message : String(err) ?? "";
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
});
