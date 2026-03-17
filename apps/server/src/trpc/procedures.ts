import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { member } from "@slushomat/db/schema";
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

const isAdmin = (ctx: {
  session: { user?: { role?: string | null } } | null;
}) => ctx.session?.user?.role === "admin";

export const adminProcedure = withErrorMapper.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  if (!isAdmin(ctx)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin role required",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.session.user,
      session: ctx.session,
    },
  });
});

export const operatorProcedure = withErrorMapper.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  if (isAdmin(ctx)) {
    return next({
      ctx: {
        ...ctx,
        user: ctx.session.user,
        session: ctx.session,
      },
    });
  }
  const membership = await ctx.db
    .select()
    .from(member)
    .where(eq(member.userId, ctx.session.user.id))
    .limit(1);
  if (membership.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Operator organization membership required",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.session.user,
      session: ctx.session,
    },
  });
});
