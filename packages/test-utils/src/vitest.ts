import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";

import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

type Options = {
  /** Test-double swaps, in Deno import-map format, relative to the package. */
  importMap?: string;
  /** Loaded into `process.env` for every test file, relative to the package. */
  envFile?: string;
  include?: string[];
};

/**
 * Applies a Deno-style import map: exact bare keys, `/`-suffixed prefix keys,
 * and relative keys matched against the importer-resolved path without
 * extension probing — so `./page-urls` is swapped but `./page-urls.ts` is not.
 */
export function importMap(file: string): Plugin {
  const base = dirname(file);
  const { imports } = JSON.parse(readFileSync(file, "utf8")) as {
    imports: Record<string, string>;
  };
  const exact = new Map<string, string>();
  const prefixes: [string, string][] = [];
  const paths = new Map<string, string>();
  for (const [key, value] of Object.entries(imports)) {
    const target = resolve(base, value);
    if (key.startsWith("./") || key.startsWith("../")) {
      paths.set(resolve(base, key), target);
    } else if (key.endsWith("/")) {
      prefixes.push([key, value.endsWith("/") ? `${target}/` : target]);
    } else {
      exact.set(key, target);
    }
  }

  return {
    name: "openstatus:import-map",
    enforce: "pre",
    resolveId(source, importer, options) {
      const swapped =
        exact.get(source) ??
        (importer && (source.startsWith("./") || source.startsWith("../"))
          ? paths.get(resolve(dirname(importer), source))
          : undefined);
      if (swapped) {
        return this.resolve(swapped, importer, { ...options, skipSelf: true });
      }
      for (const [prefix, target] of prefixes) {
        if (source.startsWith(prefix)) {
          return this.resolve(target + source.slice(prefix.length), importer, {
            ...options,
            skipSelf: true,
          });
        }
      }
      return null;
    },
  };
}

export function defineTestConfig(root: string, options: Options = {}) {
  // Like `--env-file`: the file never overrides a variable already set (CI
  // points DATABASE_URL at its own sqld).
  const fileEnv = options.envFile
    ? parseEnv(readFileSync(resolve(root, options.envFile), "utf8"))
    : {};
  const env = Object.fromEntries(
    Object.entries(fileEnv).filter(([key]) => process.env[key] === undefined),
  );
  return defineConfig({
    root,
    plugins: options.importMap
      ? [importMap(resolve(root, options.importMap))]
      : [],
    resolve: { tsconfigPaths: true },
    oxc: { jsx: { runtime: "automatic", importSource: "react" } },
    test: {
      include: options.include ?? ["**/*.test.{ts,tsx}"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
      env: env as Record<string, string>,
      // Integration suites talk to a real libSQL server; vitest's 5s default
      // is too tight for the larger seeded fixtures.
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  });
}
