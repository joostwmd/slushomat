import { router } from "../init";
import { adminProcedure } from "../procedures";

export const adminRouter = router({
  me: adminProcedure.query(({ ctx }) => ({
    user: ctx.user,
    message: "Admin access granted",
  })),
});
