import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Shared storage metadata for template and operator product images. */
export const productImage = pgTable("product_image", {
  id: text("id").primaryKey(),
  bucket: text("bucket").notNull(),
  objectPath: text("object_path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export type ProductImageRow = typeof productImage.$inferSelect;
