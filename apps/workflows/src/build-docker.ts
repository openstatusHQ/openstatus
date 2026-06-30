import path from "node:path";

// Create package.json that contains @libsql/client as dependency. It will be used to create node_modules and copy them alongside compiled server https://github.com/oven-sh/bun/issues/18909
type PackageJson = Record<"name" | "description" | "version", string> &
  Record<"dependencies", Record<string, string>>;
const packageJson: PackageJson = await Bun.file(
  path.join(__dirname, "../../../packages/db", "package.json"),
).json();

const extractDependenciesNames = ["@libsql/client"];
const workspaceConfig = await Bun.file(
  path.join(__dirname, "../../../pnpm-workspace.yaml"),
).text();

const catalog = (() => {
  const lines = workspaceConfig.split(/\r?\n/);
  let inCatalog = false;
  const entries: Record<string, string> = {};

  for (const line of lines) {
    if (!inCatalog) {
      if (line.trim() === "catalog:") {
        inCatalog = true;
      }
      continue;
    }

    if (!line.startsWith("  ")) {
      break;
    }

    const match = line.match(/^\s{2}("[^"]+"|[^:]+):\s*(.+)$/);
    if (!match) {
      continue;
    }

    const key = match[1].replace(/^"|"$/g, "").trim();
    const value = match[2].replace(/^"|"$/g, "").trim();
    entries[key] = value;
  }

  return entries;
})();

const resolveVersion = (name: string, spec: string) => {
  if (!spec.startsWith("catalog:")) {
    return spec;
  }

  const resolved = catalog[name];
  if (!resolved) {
    throw new Error(`Missing catalog entry for ${name}`);
  }

  return resolved;
};

const extractedDependencies = extractDependenciesNames.reduce(
  (acc, cur) => {
    const spec = packageJson.dependencies[cur];
    if (spec) {
      acc[cur] = resolveVersion(cur, spec);
    }

    return acc;
  },
  {} as Record<string, string>,
);

const packageJsonBuild = {
  name: packageJson.name,
  description: packageJson.description,
  version: packageJson.version,
  // type: "module",
  dependencies: extractedDependencies,
};

await Bun.write(
  "../build-docker/package.json",
  JSON.stringify(packageJsonBuild, null, 2),
);
