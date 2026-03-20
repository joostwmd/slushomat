import { router } from "../init";
import { operatorProcedure } from "../procedures";
import { operatorBusinessEntityRouter } from "./operator-business-entity";
import { operatorMachineRouter } from "./operator-machines";
import { operatorMachineSlotRouter } from "./operator-machine-slot";
import { operatorOperatorContractRouter } from "./operator-operator-contract";
import { operatorProductRouter } from "./operator-products";
import { operatorPurchaseRouter } from "./operator-purchase";

export const operatorRouter = router({
  me: operatorProcedure.query(({ ctx }) => ({
    user: ctx.user,
    message: "Operator access granted",
  })),
  product: operatorProductRouter,
  businessEntity: operatorBusinessEntityRouter,
  operatorContract: operatorOperatorContractRouter,
  machine: operatorMachineRouter,
  machineSlot: operatorMachineSlotRouter,
  purchase: operatorPurchaseRouter,
});
