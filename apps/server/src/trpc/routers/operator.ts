import { router } from "../init";
import { operatorProcedure } from "../procedures";

export const operatorRouter = router({
  me: operatorProcedure.query(({ ctx }) => ({
    user: ctx.user,
    message: "Operator access granted",
  })),
});
