import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";
import { productImage } from "./product-image";
import { templateProduct } from "./template-products";

export const operatorProduct = pgTable(
  "operator_product",
  {
    id: text("id").primaryKey(),
    operatorId: text("operator_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceInCents: integer("price_in_cents").notNull(),
    /** German VAT: 7 or 19 (validated in tRPC). */
    taxRatePercent: integer("tax_rate_percent").notNull(),
    productImageId: text("product_image_id").references(() => productImage.id, {
      onDelete: "set null",
    }),
    sourceTemplateProductId: text("source_template_product_id").references(
      () => templateProduct.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("operator_product_operator_id_idx").on(table.operatorId),
    index("operator_product_source_template_product_id_idx").on(
      table.sourceTemplateProductId,
    ),
  ],
);

export type OperatorProductRow = typeof operatorProduct.$inferSelect;
