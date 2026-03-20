import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { productImage } from "./product-image";

export const templateProduct = pgTable("template_product", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  priceInCents: integer("price_in_cents").notNull(),
  /** German VAT: 7 or 19 (validated in tRPC). */
  taxRatePercent: integer("tax_rate_percent").notNull(),
  productImageId: text("product_image_id").references(() => productImage.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export type TemplateProductRow = typeof templateProduct.$inferSelect;
