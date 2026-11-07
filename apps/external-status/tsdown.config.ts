import { defineConfig } from "tsdown";

// Inline everything except libsql, which loads a native .node addon. It ships
// as a side-car node_modules.
const external = ["@libsql/client", "libsql"];

export default defineConfig({
  entry: ["src/serve.ts"],
  format: "esm",
  platform: "node",
  target: "node26",
  fixedExtension: true,
  dts: false,
  deps: {
    neverBundle: external,
    alwaysBundle: (id) =>
      !external.some((e) => id === e || id.startsWith(`${e}/`)),
    onlyBundle: false,
  },
});
