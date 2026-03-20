import { relations, sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { businessEntity } from "./business-entity";
import { machine } from "./machines";
import { operatorProduct } from "./operator-product";

export const machineSlotEnum = pgEnum("machine_slot", [
  "left",
  "middle",
  "right",
]);

export const machineDeployment = pgTable(
  "machine_deployment",
  {
    id: text("id").primaryKey(),
    machineId: text("machine_id")
      .notNull()
      .references(() => machine.id, { onDelete: "restrict" }),
    businessEntityId: text("business_entity_id")
      .notNull()
      .references(() => businessEntity.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("machine_deployment_machine_id_idx").on(table.machineId),
    index("machine_deployment_business_entity_id_idx").on(
      table.businessEntityId,
    ),
    uniqueIndex("machine_deployment_one_open_per_machine_uidx")
      .on(table.machineId)
      .where(sql`${table.endedAt} is null`),
  ],
);

export const machineSlotConfig = pgTable(
  "machine_slot_config",
  {
    id: text("id").primaryKey(),
    machineDeploymentId: text("machine_deployment_id")
      .notNull()
      .references(() => machineDeployment.id, { onDelete: "cascade" }),
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
    index("machine_slot_config_deployment_id_idx").on(
      table.machineDeploymentId,
    ),
    uniqueIndex("machine_slot_config_deployment_slot_uidx").on(
      table.machineDeploymentId,
      table.slot,
    ),
  ],
);

export const machineDeploymentRelations = relations(
  machineDeployment,
  ({ one, many }) => ({
    machine: one(machine, {
      fields: [machineDeployment.machineId],
      references: [machine.id],
    }),
    businessEntity: one(businessEntity, {
      fields: [machineDeployment.businessEntityId],
      references: [businessEntity.id],
    }),
    slotConfigs: many(machineSlotConfig),
  }),
);

export const machineSlotConfigRelations = relations(
  machineSlotConfig,
  ({ one }) => ({
    deployment: one(machineDeployment, {
      fields: [machineSlotConfig.machineDeploymentId],
      references: [machineDeployment.id],
    }),
    operatorProduct: one(operatorProduct, {
      fields: [machineSlotConfig.operatorProductId],
      references: [operatorProduct.id],
    }),
  }),
);
