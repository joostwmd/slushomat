import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { operator } from "./auth";
import { businessEntity } from "./business-entity";
import { machineSlot } from "./machine-lifecycle";
import { machine } from "./machines";
import { operatorProduct } from "./operator-product";

export const purchase = pgTable(
  "purchase",
  {
    id: text("id").primaryKey(),
    machineSlotId: text("machine_slot_id")
      .notNull()
      .references(() => machineSlot.id, { onDelete: "restrict" }),
    machineId: text("machine_id")
      .notNull()
      .references(() => machine.id, { onDelete: "restrict" }),
    operatorId: text("operator_id")
      .notNull()
      .references(() => operator.id, { onDelete: "restrict" }),
    businessEntityId: text("business_entity_id").references(
      () => businessEntity.id,
      { onDelete: "set null" },
    ),
    operatorProductId: text("operator_product_id")
      .notNull()
      .references(() => operatorProduct.id, { onDelete: "restrict" }),
    amountInCents: integer("amount_in_cents").notNull(),
    purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("purchase_operator_id_purchased_at_idx").on(
      table.operatorId,
      table.purchasedAt.desc(),
    ),
    index("purchase_machine_id_purchased_at_idx").on(
      table.machineId,
      table.purchasedAt.desc(),
    ),
    index("purchase_business_entity_id_purchased_at_idx").on(
      table.businessEntityId,
      table.purchasedAt.desc(),
    ),
    index("purchase_machine_slot_id_idx").on(table.machineSlotId),
  ],
);
