import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";
import { machine } from "./machines";

/**
 * Operator-facing name for a machine within one operator (shared vocab for the whole tenant).
 * Admins see this alongside {@link machine.internalName}.
 */
export const operatorMachineDisplayName = pgTable(
  "operator_machine_display_name",
  {
    operatorId: text("operator_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    machineId: text("machine_id")
      .notNull()
      .references(() => machine.id, { onDelete: "cascade" }),
    orgDisplayName: text("org_display_name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.operatorId, table.machineId] }),
    index("operator_machine_display_name_machine_id_idx").on(table.machineId),
  ],
);

export const operatorMachineDisplayNameRelations = relations(
  operatorMachineDisplayName,
  ({ one }) => ({
    organization: one(organization, {
      fields: [operatorMachineDisplayName.operatorId],
      references: [organization.id],
    }),
    machine: one(machine, {
      fields: [operatorMachineDisplayName.machineId],
      references: [machine.id],
    }),
  }),
);
