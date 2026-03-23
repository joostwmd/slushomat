import { z } from "zod";

import { parseEnv } from "./parse-env";

const webEnvSchema = z.object({
  VITE_SERVER_URL: z.url(),
  VITE_OPERATOR_URL: z.url().optional(),
  /** Optional — browser upload via signed URL (anon key) */
  VITE_SUPABASE_URL: z.url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

type ViteImportMeta = ImportMeta & {
  readonly env: Record<string, string | undefined>;
};

export const env = parseEnv(
  webEnvSchema,
  (import.meta as ViteImportMeta).env,
);
