import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
  path: "../../apps/server/.env",
});

/** List each file once (no `index.ts`) so drizzle-kit does not load the same table/view twice — see `analytics-purchase-daily-summary` MV. */
const schemaFiles = [
  "./src/schema/audit-record-version.ts",
  "./src/schema/auth.ts",
  "./src/schema/machines.ts",
  "./src/schema/product-image.ts",
  "./src/schema/template-products.ts",
  "./src/schema/operator-product.ts",
  "./src/schema/business-entity.ts",
  "./src/schema/operator-contract.ts",
  "./src/schema/machine-lifecycle.ts",
  "./src/schema/purchase.ts",
  "./src/schema/analytics-purchase-daily-summary.ts",
  "./src/schema/operator-machine-display.ts",
  "./src/schema/document.ts",
  "./src/schema/invoice.ts",
] as const;

export default defineConfig({
  schema: [...schemaFiles],
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
