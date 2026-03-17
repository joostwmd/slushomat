import { TRPCError } from "@trpc/server";
import { publicProcedure } from "./init";
import { errorMapperMiddleware } from "./middleware/errorMapper";

const withErrorMapper = publicProcedure.use(errorMapperMiddleware);

export const publicProcedureWithErrorMapper = withErrorMapper;

export const protectedProcedure = withErrorMapper.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user ?? ctx.session.user,
      session: ctx.session,
    },
  });
});
