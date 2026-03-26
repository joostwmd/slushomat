import { relations, sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { operator } from "./auth";
import { businessEntity } from "./business-entity";
import { machine } from "./machines";
import { operatorProduct } from "./operator-product";

export const machineSlotEnum = pgEnum("machine_slot_side", [
  "left",
  "middle",
  "right",
]);

export const operatorMachineStatusEnum = pgEnum("operator_machine_status", [
  "active",
  "inactive",
  "killed",
]);

/**
 * Assignment of a physical machine to an operator at a business entity,
 * with deployment window and killswitch status.
 */
export const operatorMachine = pgTable(
  "operator_machine",
  {
    id: text("id").primaryKey(),
    operatorId: text("operator_id")
      .notNull()
      .references(() => operator.id, { onDelete: "cascade" }),
    machineId: text("machine_id")
      .notNull()
      .references(() => machine.id, { onDelete: "restrict" }),
    businessEntityId: text("business_entity_id")
      .notNull()
      .references(() => businessEntity.id, { onDelete: "restrict" }),
    status: operatorMachineStatusEnum("status").notNull().default("active"),
    deployedAt: timestamp("deployed_at").defaultNow().notNull(),
    undeployedAt: timestamp("undeployed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("operator_machine_operator_id_idx").on(table.operatorId),
    index("operator_machine_machine_id_idx").on(table.machineId),
    index("operator_machine_business_entity_id_idx").on(table.businessEntityId),
    uniqueIndex("operator_machine_one_open_per_machine_uidx")
      .on(table.machineId)
      .where(sql`${table.undeployedAt} is null`),
  ],
);

export const machineSlot = pgTable(
  "machine_slot",
  {
    id: text("id").primaryKey(),
    operatorMachineId: text("operator_machine_id")
      .notNull()
      .references(() => operatorMachine.id, { onDelete: "cascade" }),
    slot: machineSlotEnum("slot").notNull(),
    operatorProductId: text("operator_product_id").references(
      () => operatorProduct.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("machine_slot_operator_machine_id_idx").on(table.operatorMachineId),
    uniqueIndex("machine_slot_operator_machine_slot_uidx").on(
      table.operatorMachineId,
      table.slot,
    ),
  ],
);

export const operatorMachineRelations = relations(
  operatorMachine,
  ({ one, many }) => ({
    operator: one(operator, {
      fields: [operatorMachine.operatorId],
      references: [operator.id],
    }),
    machine: one(machine, {
      fields: [operatorMachine.machineId],
      references: [machine.id],
    }),
    businessEntity: one(businessEntity, {
      fields: [operatorMachine.businessEntityId],
      references: [businessEntity.id],
    }),
    slots: many(machineSlot),
  }),
);

export const machineSlotRelations = relations(machineSlot, ({ one }) => ({
  operatorMachine: one(operatorMachine, {
    fields: [machineSlot.operatorMachineId],
    references: [operatorMachine.id],
  }),
  operatorProduct: one(operatorProduct, {
    fields: [machineSlot.operatorProductId],
    references: [operatorProduct.id],
  }),
}));
