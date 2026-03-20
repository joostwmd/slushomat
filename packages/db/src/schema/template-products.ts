import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";

export const templateProduct = pgTable(
  "template_product",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    priceInCents: integer("price_in_cents").notNull(),
    /** German VAT: 7 or 19 (validated in tRPC). */
    taxRatePercent: integer("tax_rate_percent").notNull(),
    /** Null = global template (admin). Set when operators own catalog rows later. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("template_product_organization_id_idx").on(table.organizationId),
  ],
);

export const templateProductImage = pgTable(
  "template_product_image",
  {
    id: text("id").primaryKey(),
    templateProductId: text("template_product_id")
      .notNull()
      .references(() => templateProduct.id, { onDelete: "cascade" }),
    bucket: text("bucket").notNull(),
    objectPath: text("object_path").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("template_product_image_template_product_id_uidx").on(
      table.templateProductId,
    ),
  ],
);

export type TemplateProductRow = typeof templateProduct.$inferSelect;
export type TemplateProductImageRow = typeof templateProductImage.$inferSelect;
