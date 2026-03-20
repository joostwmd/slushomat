import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN_ADMIN: z.url(),
    CORS_ORIGIN_OPERATOR: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    /** Optional — required for template product image uploads */
    SUPABASE_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    SUPABASE_STORAGE_BUCKET_TEMPLATE_PRODUCTS: z
      .string()
      .min(1)
      .optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
