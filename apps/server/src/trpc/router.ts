import { router } from "./init";
import {
  protectedProcedure,
  publicProcedureWithErrorMapper as publicProcedure,
} from "./procedures";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
});

export type AppRouter = typeof appRouter;
