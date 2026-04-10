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
  /** Required for `org` / `org-user` — pass `organization` from auth schema. */
  references?: {
    organization?: RefTable;
    user?: RefTable;
  };
}

/**
 * Single-table entity with standard id, scope columns, timestamps, optional soft-delete.
 */
export function defineStaticEntity(config: DefineStaticEntityConfig): any {
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

  const organizationTable = references?.organization;
  const userTable = references?.user;

  const orgPart =
    scope === "org" || scope === "org-user"
      ? {
          operatorId: text("operator_id")
            .notNull()
            .references(() => organizationTable.id, { onDelete: "cascade" }),
        }
      : {};

  const userPart =
    scope === "user" || scope === "org-user"
      ? {
          userId: text("user_id")
            .notNull()
            .references(() => userTable.id, { onDelete: "cascade" }),
        }
      : {};

  const core = {
    id: text("id").primaryKey(),
    ...orgPart,
    ...userPart,
    ...columns,
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  };

  const buildIndexes = (t: {
    operatorId?: unknown;
    userId?: unknown;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any[] = [];
    if ("operatorId" in t && t.operatorId) {
      out.push(index(`${name}_operator_id_idx`).on(t.operatorId as never));
    }
    if ("userId" in t && t.userId) {
      out.push(index(`${name}_user_id_idx`).on(t.userId as never));
    }
    return out;
  };

  if (softDelete) {
    return pgTable(
      name,
      // `columns` is Record<string, any> — Drizzle cannot infer a single overload; runtime is correct.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { ...core, deletedAt: timestamp("deleted_at") } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((t: any) => buildIndexes(t)) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;
  }

  return pgTable(
    name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    core as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((t: any) => buildIndexes(t)) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;
}
