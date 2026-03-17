import { router } from "./init";
import {
  protectedProcedure,
  publicProcedureWithErrorMapper as publicProcedure,
} from "./procedures";
import { adminRouter } from "./routers/admin";
import { operatorRouter } from "./routers/operator";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  privateData: protectedProcedure.query(({ ctx }) => ({
    message: "This is private",
    user: ctx.session!.user,
  })),
  admin: adminRouter,
  operator: operatorRouter,
});

export type AppRouter = typeof appRouter;
