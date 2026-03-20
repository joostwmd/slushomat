import { integer, pgEnum, text, timestamp } from "drizzle-orm/pg-core";

import { defineVersionedEntity } from "../model-factory";
import { organization } from "./auth";
import { businessEntity } from "./business-entity";
import { machine } from "./machines";

export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "active",
  "terminated",
]);

const contractModel = defineVersionedEntity({
  name: "operator_contract",
  scope: "org",
  references: { organization },
  baseColumns: {
    businessEntityId: text("business_entity_id")
      .notNull()
      .references(() => businessEntity.id, { onDelete: "restrict" }),
    machineId: text("machine_id")
      .notNull()
      .references(() => machine.id, { onDelete: "restrict" }),
  },
  versionColumns: {
    status: contractStatusEnum("status").notNull(),
    effectiveDate: timestamp("effective_date").notNull(),
    endedAt: timestamp("ended_at"),
    monthlyRentInCents: integer("monthly_rent_in_cents").notNull(),
    revenueShareBasisPoints: integer("revenue_share_basis_points").notNull(),
    /** Supabase Storage — same pattern as product images (T03). */
    pdfBucket: text("pdf_bucket"),
    pdfObjectPath: text("pdf_object_path"),
    notes: text("notes"),
  },
});

export const operatorContract = contractModel.base;
/** Version columns come from a spread in the factory; Drizzle omits them from inferred table types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const operatorContractVersion: any = contractModel.versions;
export const operatorContractChange = contractModel.changes;
export const operatorContractBaseRelations = contractModel.baseRelations;
export const operatorContractVersionRelations =
  contractModel.versionsRelations;
export const operatorContractChangeRelations = contractModel.changesRelations;
