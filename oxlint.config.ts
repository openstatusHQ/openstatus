import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["eslint", "typescript", "react", "unicorn", "oxc"],
  jsPlugins: ["./tooling/oxlint/plugin.js"],
  categories: {
    correctness: "warn",
  },
  rules: {
    // Kept off for parity with the previous Biome config.
    "react/no-array-index-key": "off", // biome suspicious/noArrayIndexKey
    "no-case-declarations": "off", // biome correctness/noSwitchDeclarations
    // No oxlint equivalent, so dropped: biome performance/noAccumulatingSpread,
    // complexity/noForEach, a11y/noSvgWithoutTitle, a11y/useAltText,
    // a11y/useKeyWithClickEvents. Their suppressions are removed.

    // Mirror Biome's recommended set. Existing violations are suppressed in-code.
    "no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrors: "none",
      },
    ],
    "typescript/no-explicit-any": "error",
    "typescript/no-non-null-assertion": "error",
    "react/no-danger": "error",
    "react/exhaustive-deps": "warn",
    "unicorn/prefer-node-protocol": "error",
  },
  ignorePatterns: [
    // Deliberately bad code, linted by tooling/oxlint/check-fixtures.mts.
    "tooling/oxlint/fixtures/**",
    "packages/ui/src/components/*.ts",
    "packages/ui/src/components/*.tsx",
    // Vendored from the data-table-filters shadcn registry — reformatting or
    // hand-patching these makes the next `shadcn add` a merge conflict.
    "packages/ui/src/components/data-table-filters/**",
    "packages/ui/src/lib/data-table-filters/**",
    "apps/dashboard/src/lib/react-table.d.ts",
    "packages/ui/src/react-table.d.ts",
    "apps/dashboard/src/scripts/*.ts",
    "packages/proto/gen/**",
    "**/*_pb.ts",
    "**/drizzle/meta/**",
    "**/.content-collections/**",
    ".devbox/**",
    "**/*.astro",
  ],
  overrides: [
    {
      // No db client or query builder in layers migrated onto
      // @openstatus/services. Schemas and constants stay importable.
      files: [
        "packages/api/src/router/**",
        "apps/server/src/routes/rpc/**",
        "apps/server/src/routes/slack/interactions.ts",
        "apps/status-page/src/**",
      ],
      excludeFiles: [
        "**/__tests__/**",
        "**/*.test.ts",
        // Infrastructure, not workspace data: the db health probe and the
        // Auth.js adapter that owns the viewer session tables.
        "apps/status-page/src/app/api/health/route.ts",
        "apps/status-page/src/lib/auth/adapter.ts",
      ],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            // Type imports carry no runtime access, so db shapes stay usable.
            paths: [
              {
                name: "@openstatus/db",
                allowTypeImports: true,
                message:
                  "Use @openstatus/services instead (domain has migrated to the service layer).",
              },
              {
                name: "drizzle-orm",
                allowTypeImports: true,
                message: "Use @openstatus/services instead.",
              },
            ],
            patterns: [
              {
                group: [
                  "@openstatus/db/**",
                  "!@openstatus/db/src/schema",
                  "!@openstatus/db/src/schema/**",
                  "drizzle-orm/**",
                ],
                allowTypeImports: true,
                message: "Use @openstatus/services instead.",
              },
            ],
          },
        ],
      },
    },
    {
      // Tests legitimately use `any` for spies/fixtures.
      files: ["**/*.test.ts", "**/__tests__/**"],
      rules: {
        "typescript/no-explicit-any": "off",
      },
    },
    {
      // Behaviour-triggered, not filename-triggered: anything opening a
      // transaction in the services layer is a mutation.
      files: ["packages/services/src/**/*.ts"],
      excludeFiles: ["**/__tests__/**", "**/*.test.ts"],
      rules: {
        "openstatus/services-mutation-guards": "error",
        "openstatus/services-audit-on-tx": "error",
        // Group from the folder; non-group folders are skipped by the rule.
        "openstatus/services-scope-matches-folder": "error",
        // The package stays Edge-safe by design.
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["node:*"],
                message:
                  "@openstatus/services must stay runtime-agnostic — no node built-ins. Hand-roll the helper (see deepEqual) or move the code to a Node-only package.",
              },
            ],
          },
        ],
      },
    },
    {
      // Verbs require a group scope; "read"/"write" are what credentials hold.
      files: ["packages/services/src/**/*.ts", "apps/server/src/**/*.ts"],
      excludeFiles: [
        "**/__tests__/**",
        "**/*.test.ts",
        "packages/services/src/auth/**",
      ],
      rules: {
        "openstatus/services-no-legacy-scope": "error",
      },
    },
    {
      // Shape-triggered: an exported list/get/search/stream/preview verb in
      // one of the five scope groups must check `<group>:read`.
      files: [
        "packages/services/src/{monitor,monitor-tag,private-location,monitor-incident,frozen-uptime,maintenance-window}/*.ts",
        "packages/services/src/{page,page-component,page-component-group,import}/*.ts",
        "packages/services/src/{status-report,incident,maintenance}/*.ts",
        "packages/services/src/notification/*.ts",
        "packages/services/src/page-subscriber/*.ts",
      ],
      excludeFiles: ["**/__tests__/**", "**/*.test.ts", "**/internal.ts"],
      rules: {
        "openstatus/services-read-verbs-require-scope": "error",
      },
    },
    {
      files: ["apps/dashboard/src/**/*.tsx", "apps/dashboard/src/**/*.ts"],
      rules: {
        "openstatus/no-db-barrel-in-client": "error",
        "openstatus/no-text-link-as-child": "error",
      },
    },
  ],
});
