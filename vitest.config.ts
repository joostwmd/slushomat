import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["apps/admin-frontend/**/*.test.{ts,tsx}"],
          exclude: ["**/node_modules/**", "**/dist/**", "tests/**"],
          setupFiles: ["./apps/admin-frontend/vitest.setup.ts"],
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "apps/admin-frontend/src"),
          },
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**", "apps/**"],
          setupFiles: ["./tests/setup.ts"],
        },
      },
    ],
  },
});
