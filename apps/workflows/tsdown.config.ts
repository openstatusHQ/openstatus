import { defineConfig } from "tsdown";

// Inline everything except the packages that can't be bundled: libsql loads a
// native .node addon, and google-gax / google-proto-files (under
// @google-cloud/tasks and @google-cloud/pubsub) read files via CJS __dirname.
// Those ship as a side-car node_modules.
const external = [
  "@libsql/client",
  "libsql",
  "@google-cloud/tasks",
  "@google-cloud/pubsub",
];

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
