import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";
import { businessEntity } from "./business-entity";
import { operatorContract } from "./operator-contract";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
]);

export const invoiceLineTypeEnum = pgEnum("invoice_line_type", [
  "rent",
  "revenue_share",
  "fee",
  "other",
]);

export const invoice = pgTable(
  "invoice",
  {
    id: text("id").primaryKey(),
    operatorId: text("operator_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    businessEntityId: text("business_entity_id")
      .notNull()
      .references(() => businessEntity.id, { onDelete: "restrict" }),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceDate: date("invoice_date", { mode: "date" }).notNull(),
    dueDate: date("due_date", { mode: "date" }),
    periodStart: date("period_start", { mode: "date" }).notNull(),
    periodEnd: date("period_end", { mode: "date" }).notNull(),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    totalAmountCents: integer("total_amount_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("invoice_operator_id_idx").on(table.operatorId),
    index("invoice_business_entity_id_idx").on(table.businessEntityId),
    index("invoice_invoice_date_idx").on(table.invoiceDate),
  ],
);

export const invoiceLineItem = pgTable(
  "invoice_line_item",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),
    contractId: text("contract_id").references(() => operatorContract.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 })
      .notNull()
      .default("1"),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    lineType: invoiceLineTypeEnum("line_type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("invoice_line_item_invoice_id_idx").on(table.invoiceId),
  ],
);

export const invoiceRelations = relations(invoice, ({ one, many }) => ({
  organization: one(organization, {
    fields: [invoice.operatorId],
    references: [organization.id],
  }),
  businessEntity: one(businessEntity, {
    fields: [invoice.businessEntityId],
    references: [businessEntity.id],
  }),
  lineItems: many(invoiceLineItem),
}));

export const invoiceLineItemRelations = relations(
  invoiceLineItem,
  ({ one }) => ({
    invoice: one(invoice, {
      fields: [invoiceLineItem.invoiceId],
      references: [invoice.id],
    }),
    contract: one(operatorContract, {
      fields: [invoiceLineItem.contractId],
      references: [operatorContract.id],
    }),
  }),
);
