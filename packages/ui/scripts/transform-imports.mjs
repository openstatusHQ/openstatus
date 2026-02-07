#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, "..");
const SRC_DIR = join(ROOT_DIR, "src");
const DIST_DIR = join(ROOT_DIR, "dist");

console.log("🔄 Starting import transformation...");

// Clean up any existing dist directory
if (existsSync(DIST_DIR)) {
  rmSync(DIST_DIR, { recursive: true, force: true });
}

// Create dist directory
mkdirSync(DIST_DIR, { recursive: true });

// Copy source files to dist directory
console.log("📁 Copying source files to dist directory...");
cpSync(SRC_DIR, join(DIST_DIR, "src"), { recursive: true });

// Transform imports in all TypeScript/TSX files
console.log("✨ Transforming imports from @openstatus/ui to @...");
const files = globSync("**/*.{ts,tsx}", {
  cwd: join(DIST_DIR, "src"),
  absolute: true,
});

let transformCount = 0;
for (const file of files) {
  let content = readFileSync(file, "utf-8");
  const originalContent = content;

  // Replace all @openstatus/ui imports with @
  content = content.replace(
    /@openstatus\/ui\/(components|lib|hooks|types)/g,
    "@/$1",
  );

  if (content !== originalContent) {
    writeFileSync(file, content, "utf-8");
    transformCount++;
  }
}

console.log(`✅ Transformed ${transformCount} files`);

// Create a temporary tsconfig.json with updated paths
console.log("📝 Creating temporary tsconfig.json...");
const originalTsConfig = JSON.parse(
  readFileSync(join(ROOT_DIR, "tsconfig.json"), "utf-8"),
);
const tmpTsConfig = {
  ...originalTsConfig,
  compilerOptions: {
    ...originalTsConfig.compilerOptions,
    paths: {
      "@/*": ["./src/*"],
    },
  },
};
writeFileSync(
  join(DIST_DIR, "tsconfig.json"),
  JSON.stringify(tmpTsConfig, null, 2),
  "utf-8",
);

// Transform and copy registry.json with full URLs for custom dependencies
console.log("📋 Transforming registry.json...");
const registryJsonPath = join(ROOT_DIR, "registry.json");
if (existsSync(registryJsonPath)) {
  const registryJson = JSON.parse(readFileSync(registryJsonPath, "utf-8"));

  // Determine the base URL for the registry
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/r`
    : "https://openstatus.dev/r";

  console.log(`🔗 Using registry base URL: ${baseUrl}`);

  // Transform registryDependencies for all items
  if (registryJson.items) {
    for (const item of registryJson.items) {
      if (
        item.registryDependencies &&
        Array.isArray(item.registryDependencies)
      ) {
        item.registryDependencies = item.registryDependencies.map((dep) => {
          // Prefix custom OpenStatus components (status-* and use-*) with full URL
          if (dep.startsWith("status-") || dep.startsWith("use-")) {
            return `${baseUrl}/${dep}.json`;
          }
          // Leave shadcn components unprefixed
          return dep;
        });
      }
    }
  }

  writeFileSync(
    join(DIST_DIR, "registry.json"),
    JSON.stringify(registryJson, null, 2),
    "utf-8",
  );
  console.log(
    "✅ Transformed registry.json with full URLs for custom dependencies",
  );
}

// Transform and copy components.json
console.log("📝 Transforming components.json...");
const componentsJsonPath = join(ROOT_DIR, "components.json");
if (existsSync(componentsJsonPath)) {
  const componentsJson = JSON.parse(readFileSync(componentsJsonPath, "utf-8"));

  // Transform aliases from @openstatus/ui to @
  if (componentsJson.aliases) {
    const transformedAliases = {};
    for (const [key, value] of Object.entries(componentsJson.aliases)) {
      if (typeof value === "string") {
        transformedAliases[key] = value.replace(/^@openstatus\/ui\//, "@/");
      } else {
        transformedAliases[key] = value;
      }
    }
    componentsJson.aliases = transformedAliases;
  }

  writeFileSync(
    join(DIST_DIR, "components.json"),
    JSON.stringify(componentsJson, null, 2),
    "utf-8",
  );
  console.log("✅ Transformed components.json aliases");
}

console.log("✅ Transformation complete! Transformed files ready in dist/");
console.log("🏗️  Next step: Run shadcn build in the dist directory");
