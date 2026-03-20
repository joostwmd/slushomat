import { index } from "drizzle-orm/pg-core";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type StaticEntityScope = "org" | "user" | "org-user" | "app";

/** Table with an `id` column (e.g. `organization`, `user` from auth schema). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RefTable = any;

export interface DefineStaticEntityConfig {
  /** Snake_case table name, e.g. `business_entity`. */
  name: string;
  scope: StaticEntityScope;
  softDelete?: boolean;
  /** Drizzle column builders, e.g. `{ name: text("name").notNull() }`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: Record<string, any>;
  /** Required for `org` / `org-user` — pass e.g. `organization` from auth schema. */
  references?: {
    organization?: RefTable;
    user?: RefTable;
  };
}

/**
 * Single-table entity with standard id, scope columns, timestamps, optional soft-delete.
 */
export function defineStaticEntity(config: DefineStaticEntityConfig) {
  const { name, scope, softDelete, columns, references } = config;

  if (
    (scope === "org" || scope === "org-user") &&
    !references?.organization
  ) {
    throw new Error(
      `defineStaticEntity("${name}"): scope "${scope}" requires references.organization`,
    );
  }
  if (
    (scope === "user" || scope === "org-user") &&
    !references?.user
  ) {
    throw new Error(
      `defineStaticEntity("${name}"): scope "${scope}" requires references.user`,
    );
  }

  const orgTable = references?.organization;
  const userTable = references?.user;

  const columnShape = {
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
    ...columns,
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ...(softDelete ? { deletedAt: timestamp("deleted_at") } : {}),
  };

  return pgTable(
    name,
    columnShape,
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
}
