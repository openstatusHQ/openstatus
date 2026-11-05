import { defineConfig } from "tsdown";

// The image ships dist/ without node_modules, so every dependency is inlined.
export default defineConfig({
  entry: ["src/serve.ts"],
  format: "esm",
  platform: "node",
  target: "node26",
  fixedExtension: true,
  dts: false,
  deps: { alwaysBundle: [/.*/], onlyBundle: false },
});
