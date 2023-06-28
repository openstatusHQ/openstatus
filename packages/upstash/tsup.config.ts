import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: "src/index.ts",
  format: ["esm"],
  // watch if NODE_ENV === "development"
});
