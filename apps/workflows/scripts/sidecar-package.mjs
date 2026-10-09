// Writes the package.json for the side-car node_modules that ships next to the
// bundle: the packages tsdown leaves external, pinned to the versions pnpm
// installed so the image runs what was tested.
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { findPackageJSON } from "node:module";

const [outFile] = process.argv.slice(2);
if (!outFile) throw new Error("usage: sidecar-package.mjs <out/package.json>");

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const workflows = new URL("../package.json", import.meta.url);
const libsqlClient = findPackageJSON("@libsql/client", workflows);
const tasks = findPackageJSON("@google-cloud/tasks", workflows);
// Resolve from the real path: pnpm only links libsql inside @libsql/client's store dir.
const libsql = findPackageJSON("libsql", realpathSync(libsqlClient));

const dependencies = {
  "@libsql/client": read(libsqlClient).version,
  libsql: read(libsql).version,
  "@google-cloud/tasks": read(tasks).version,
};
writeFileSync(
  outFile,
  `${JSON.stringify({ private: true, dependencies }, null, 2)}\n`,
);
