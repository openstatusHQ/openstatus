// Writes the package.json for the side-car node_modules that ships next to the
// bundle: the packages tsdown leaves external, pinned to the versions pnpm
// installed so the image runs what was tested. Their transitive dependencies
// are pinned too, through npm `overrides`, by walking pnpm's install.
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { findPackageJSON } from "node:module";

const [outFile] = process.argv.slice(2);
if (!outFile) throw new Error("usage: sidecar-package.mjs <out/package.json>");

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const workflows = new URL("../package.json", import.meta.url);
// Resolve from real paths: pnpm only links a package's deps inside its store dir.
const resolve = (name, from) => realpathSync(findPackageJSON(name, from));

const externals = ["@libsql/client", "libsql", "@google-cloud/tasks"];
const versions = new Map();
const seen = new Set();

function walk(path) {
  if (seen.has(path)) return;
  seen.add(path);
  const pkg = read(path);
  const pinned = versions.get(pkg.name);
  if (pinned && pinned !== pkg.version) {
    throw new Error(
      `${pkg.name} resolves to both ${pinned} and ${pkg.version}; a flat override can't pin both`,
    );
  }
  versions.set(pkg.name, pkg.version);
  for (const name of Object.keys(pkg.dependencies ?? {})) {
    walk(resolve(name, path));
  }
  // Platform binaries: pnpm installs only the build platform's, the rest don't resolve.
  for (const name of Object.keys(pkg.optionalDependencies ?? {})) {
    let dep;
    try {
      dep = resolve(name, path);
    } catch {
      continue;
    }
    walk(dep);
  }
}

const libsqlClient = resolve("@libsql/client", workflows);
walk(libsqlClient);
walk(resolve("libsql", libsqlClient));
walk(resolve("@google-cloud/tasks", workflows));

const dependencies = {};
const overrides = {};
for (const [name, version] of [...versions].sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  (externals.includes(name) ? dependencies : overrides)[name] = version;
}
writeFileSync(
  outFile,
  `${JSON.stringify({ private: true, dependencies, overrides }, null, 2)}\n`,
);
