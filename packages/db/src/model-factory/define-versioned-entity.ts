import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { StaticEntityScope } from "./define-static-entity";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RefTable = any;

export interface DefineVersionedEntityConfig {
  /** Snake_case base table name, e.g. `operator_contract`. */
  name: string;
  scope: StaticEntityScope;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  baseColumns: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  versionColumns: Record<string, any>;
  references?: {
    organization?: RefTable;
    user?: RefTable;
  };
}

/**
 * Base + versions + changes tables with relations (circular FKs resolved via `let`).
 */
export function defineVersionedEntity(config: DefineVersionedEntityConfig) {
  const { name, scope, baseColumns, versionColumns, references } = config;

  if (
    (scope === "org" || scope === "org-user") &&
    !references?.organization
  ) {
    throw new Error(
      `defineVersionedEntity("${name}"): scope "${scope}" requires references.organization`,
    );
  }
  if (
    (scope === "user" || scope === "org-user") &&
    !references?.user
  ) {
    throw new Error(
      `defineVersionedEntity("${name}"): scope "${scope}" requires references.user`,
    );
  }

  const orgTable = references?.organization;
  const userTable = references?.user;
  const versionTableName = `${name}_version`;
  const changeTableName = `${name}_change`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let baseTable: any;

  const versionsTable = pgTable(
    versionTableName,
    {
      id: text("id").primaryKey(),
      entityId: text("entity_id")
        .notNull()
        .references(() => baseTable.id, { onDelete: "cascade" }),
      versionNumber: integer("version_number").notNull(),
      ...versionColumns,
      createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [
      index(`${versionTableName}_entity_id_idx`).on(t.entityId),
      uniqueIndex(`${versionTableName}_entity_version_uidx`).on(
        t.entityId,
        t.versionNumber,
      ),
    ],
  );

  baseTable = pgTable(
    name,
    {
      id: text("id").primaryKey(),
      ...(scope === "org" || scope === "org-user"
        ? {
            organizationId: text("organization_id")
              .notNull()
              .references(() => orgTable.id, { onDelete: "cascade" }),
          }
        : {}),
      ...(scope === "user" || scope === "org-user"
        ? {
            userId: text("user_id")
              .notNull()
              .references(() => userTable.id, { onDelete: "cascade" }),
          }
        : {}),
      ...baseColumns,
      currentVersionId: text("current_version_id").references(
        () => versionsTable.id,
        { onDelete: "set null" },
      ),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
    },
    (t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out: any[] = [];
      if ("organizationId" in t && t.organizationId) {
        out.push(index(`${name}_organization_id_idx`).on(t.organizationId));
      }
      if ("userId" in t && t.userId) {
        out.push(index(`${name}_user_id_idx`).on(t.userId));
      }
      return out;
    },
  );

  const changesTable = pgTable(
    changeTableName,
    {
      id: text("id").primaryKey(),
      entityId: text("entity_id")
        .notNull()
        .references(() => baseTable.id, { onDelete: "cascade" }),
      versionId: text("version_id").references(() => versionsTable.id, {
        onDelete: "set null",
      }),
      action: text("action").notNull(),
      actorUserId: text("actor_user_id"),
      actorUserName: text("actor_user_name"),
      actorUserEmail: text("actor_user_email"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [index(`${changeTableName}_entity_id_idx`).on(t.entityId)],
  );

  const baseRelations = relations(baseTable, ({ one, many }) => ({
    currentVersion: one(versionsTable, {
      fields: [baseTable.currentVersionId],
      references: [versionsTable.id],
    }),
    versions: many(versionsTable),
    changes: many(changesTable),
  }));

  const versionsRelations = relations(versionsTable, ({ one, many }) => ({
    entity: one(baseTable, {
      fields: [versionsTable.entityId],
      references: [baseTable.id],
    }),
    changes: many(changesTable),
  }));

  const changesRelations = relations(changesTable, ({ one }) => ({
    entity: one(baseTable, {
      fields: [changesTable.entityId],
      references: [baseTable.id],
    }),
    version: one(versionsTable, {
      fields: [changesTable.versionId],
      references: [versionsTable.id],
    }),
  }));

  return {
    base: baseTable,
    versions: versionsTable,
    changes: changesTable,
    baseRelations,
    versionsRelations,
    changesRelations,
  };
}
