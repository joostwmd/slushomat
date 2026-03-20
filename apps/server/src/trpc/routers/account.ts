import { TRPCError } from "@trpc/server";
import { APIError } from "better-auth";
import { z } from "zod";
import { auth } from "@slushomat/auth";
import { router } from "../init";
import { protectedProcedure } from "../procedures";

const changePasswordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const changePasswordOutput = z.object({ ok: z.literal(true) });

export const accountRouter = router({
  changePassword: protectedProcedure
    .input(changePasswordInput)
    .output(changePasswordOutput)
    .mutation(async ({ input, ctx }) => {
      const authSession = ctx.session.session as
        | { impersonatedBy?: string | null }
        | undefined;
      if (authSession?.impersonatedBy) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot change password while impersonating",
        });
      }

      try {
        // Omit revokeOtherSessions: rotating sessions sets cookies via Better Auth's
        // HTTP response; tRPC JSON does not forward Set-Cookie to the browser.
        await auth.api.changePassword({
          body: {
            currentPassword: input.currentPassword,
            newPassword: input.newPassword,
          },
          headers: ctx.headers,
        });
        return { ok: true as const };
      } catch (err) {
        if (err instanceof APIError) {
          const message =
            (typeof err.body?.message === "string" && err.body.message) ||
            err.message ||
            "";
          switch (err.status) {
            case "UNAUTHORIZED":
              throw new TRPCError({
                code: "UNAUTHORIZED",
                message: message || "Authentication required",
                cause: err,
              });
            case "BAD_REQUEST":
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: message || "Invalid current password or new password",
                cause: err,
              });
            case "FORBIDDEN":
              throw new TRPCError({
                code: "FORBIDDEN",
                message: message || "Not allowed to change password",
                cause: err,
              });
            case "NOT_FOUND":
              throw new TRPCError({
                code: "NOT_FOUND",
                message: message || "Account not found",
                cause: err,
              });
            default:
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to change password",
                cause: err,
              });
          }
        }

        const message =
          err instanceof Error ? err.message : String(err);
        const lower = message.toLowerCase();

        if (
          lower.includes("unauthorized") ||
          lower.includes("not authenticated") ||
          lower.includes("session")
        ) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: message || "Authentication required",
            cause: err,
          });
        }
        if (
          lower.includes("invalid") ||
          lower.includes("bad request") ||
          lower.includes("incorrect") ||
          lower.includes("wrong password") ||
          lower.includes("too short") ||
          lower.includes("too long")
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: message || "Invalid password change request",
            cause: err,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to change password",
          cause: err,
        });
      }
    }),
});
