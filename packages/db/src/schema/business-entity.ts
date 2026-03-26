import { text } from "drizzle-orm/pg-core";

import { defineStaticEntity } from "../model-factory";
import { operator } from "./auth";

export const businessEntity = defineStaticEntity({
  name: "business_entity",
  scope: "org",
  softDelete: true,
  references: { operator },
  columns: {
    name: text("name").notNull(),
    legalName: text("legal_name").notNull(),
    legalForm: text("legal_form").notNull(),
    vatId: text("vat_id").notNull(),
    street: text("street").notNull(),
    city: text("city").notNull(),
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull().default("DE"),
  },
});
