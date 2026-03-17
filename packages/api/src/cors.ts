import { cors } from "hono/cors";

export type CorsOptions = {
  origin: string | string[];
  allowMethods?: string[];
  allowHeaders?: string[];
  credentials?: boolean;
};

export function createCors(options: CorsOptions) {
  return cors({
    origin: options.origin,
    allowMethods: options.allowMethods ?? ["GET", "POST", "OPTIONS"],
    allowHeaders: options.allowHeaders ?? ["Content-Type", "Authorization"],
    credentials: options.credentials ?? true,
  });
}
