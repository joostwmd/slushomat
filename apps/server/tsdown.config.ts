import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/http-app.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  noExternal: [/@slushomat\/.*/],
});
