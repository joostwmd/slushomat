import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { apikey } from "./auth";

export const machineVersion = pgTable(
  "machine_version",
  {
    id: text("id").primaryKey(),
    versionNumber: text("version_number").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("machine_version_version_number_unique").on(table.versionNumber),
  ],
);

export const machine = pgTable(
  "machine",
  {
    id: text("id").primaryKey(),
    machineVersionId: text("machine_version_id")
      .notNull()
      .references(() => machineVersion.id, { onDelete: "restrict" }),
    comments: text("comments").notNull().default(""),
    disabled: boolean("disabled").default(false).notNull(),
    apiKeyId: text("api_key_id").references(() => apikey.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("machine_api_key_id_idx").on(table.apiKeyId)],
);
