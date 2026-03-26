import { index, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Stored file kind (business documents — not product images). */
export const documentKindEnum = pgEnum("document_kind", [
  "contract",
  "invoice",
  "other",
]);

/**
 * Supabase Storage pointer for PDFs and other business documents.
 * Use `entity_type` + `entity_id` to link to owning row (e.g. `operator_contract_version`, `invoice`).
 */
export const document = pgTable(
  "document",
  {
    id: text("id").primaryKey(),
    kind: documentKindEnum("kind").notNull(),
    /** Owning model name for application joins, e.g. `operator_contract_version`. */
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    bucket: text("bucket").notNull(),
    objectPath: text("object_path").notNull(),
    filename: text("filename"),
    mimeType: text("mime_type"),
    fileSizeBytes: integer("file_size_bytes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("document_entity_idx").on(table.entityType, table.entityId),
    index("document_kind_idx").on(table.kind),
  ],
);

export type DocumentRow = typeof document.$inferSelect;
