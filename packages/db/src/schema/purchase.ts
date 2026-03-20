import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";
import { businessEntity } from "./business-entity";
import { machineSlotEnum } from "./machine-lifecycle";
import { machine } from "./machines";
import { operatorProduct } from "./operator-product";

export const purchase = pgTable(
  "purchase",
  {
    id: text("id").primaryKey(),
    machineId: text("machine_id")
      .notNull()
      .references(() => machine.id, { onDelete: "restrict" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    businessEntityId: text("business_entity_id").references(
      () => businessEntity.id,
      { onDelete: "set null" },
    ),
    operatorProductId: text("operator_product_id")
      .notNull()
      .references(() => operatorProduct.id, { onDelete: "restrict" }),
    slot: machineSlotEnum("slot").notNull(),
    amountInCents: integer("amount_in_cents").notNull(),
    purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("purchase_organization_id_purchased_at_idx").on(
      table.organizationId,
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
  ],
);
