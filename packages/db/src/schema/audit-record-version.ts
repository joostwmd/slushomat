import {
  integer,
  jsonb,
  pgSchema,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const auditSchema = pgSchema("audit");

/** Populated by `audit.insert_update_delete_trigger` — see `0000_analytics_purchase_daily_summary.sql`. */
export const auditRecordVersion = auditSchema.table("record_version", {
  id: serial("id").primaryKey(),
  recordId: text("record_id"),
  oldRecordId: text("old_record_id"),
  op: text("op"),
  ts: timestamp("ts", { mode: "date" }).defaultNow().notNull(),
  tableOid: integer("table_oid").notNull(),
  tableSchema: text("table_schema").notNull(),
  tableName: text("table_name").notNull(),
  record: jsonb("record"),
  oldRecord: jsonb("old_record"),
});
