import path from "node:path";


// Create package.json that contains @libsql/client as dependency. It will be used to create node_modules and copy them alongside compiled server https://github.com/oven-sh/bun/issues/18909
type PackageJson = Record<"name" | "description" | "version", string> &
  Record<"dependencies", Record<string, string>>;
const packageJson: PackageJson = await Bun.file(
  path.join(__dirname, "../../../packages/db", "package.json"),
).json();

const extractDependenciesNames = ["@libsql/client"];
const extractedDependencies = extractDependenciesNames.reduce(
  (acc, cur) => {
    if (packageJson.dependencies[cur]) {
      acc[cur] = packageJson.dependencies[cur];
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
