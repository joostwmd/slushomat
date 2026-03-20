import { router } from "../init";
import { operatorProcedure } from "../procedures";
import { operatorProductRouter } from "./operator-products";

export const operatorRouter = router({
  me: operatorProcedure.query(({ ctx }) => ({
    user: ctx.user,
    message: "Operator access granted",
  })),
  product: operatorProductRouter,
});
