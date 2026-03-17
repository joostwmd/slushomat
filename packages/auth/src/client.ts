import { createAuthClient } from "better-auth/react";
import { adminClient, oneTimeTokenClient } from "better-auth/client/plugins";
import { env } from "@slushomat/env/web";

export const authClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL,
  plugins: [adminClient(), oneTimeTokenClient()],
});
