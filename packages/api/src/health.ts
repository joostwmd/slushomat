/**
 * Simple health check response. Use for /healthz endpoints.
 */
export function healthzResponse() {
  return {
    status: "ok" as const,
    uptime: process.uptime(),
  };
}
