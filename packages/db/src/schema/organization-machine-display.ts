import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";
import { machine } from "./machines";

/**
 * Operator-facing name for a machine within one organization (shared vocab for the whole org).
 * Admins see this alongside {@link machine.internalName}.
 */
export const organizationMachineDisplayName = pgTable(
  "organization_machine_display_name",
  {
    organizationId: text("organization_id")
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
    uniqueIndex("organization_machine_display_name_org_machine_uidx").on(
      table.organizationId,
      table.machineId,
    ),
    index("organization_machine_display_name_machine_id_idx").on(
      table.machineId,
    ),
  ],
);

export const organizationMachineDisplayNameRelations = relations(
  organizationMachineDisplayName,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationMachineDisplayName.organizationId],
      references: [organization.id],
    }),
    machine: one(machine, {
      fields: [organizationMachineDisplayName.machineId],
      references: [machine.id],
    }),
  }),
);
