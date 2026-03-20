import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_SERVER_URL: z.url(),
    VITE_OPERATOR_URL: z.url().optional(),
    /** Optional — browser upload via signed URL (anon key) */
    VITE_SUPABASE_URL: z.url().optional(),
    VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});
