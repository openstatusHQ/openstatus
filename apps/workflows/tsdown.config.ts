import { defineConfig } from "tsdown";

// Inline everything except the packages that can't be bundled: libsql loads a
// native .node addon, and google-proto-files (under @google-cloud/tasks) reads
// files via CJS __dirname. Those three ship as a side-car node_modules.
const external = ["@libsql/client", "libsql", "@google-cloud/tasks"];

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
