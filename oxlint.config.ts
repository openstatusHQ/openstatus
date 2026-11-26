import { defineConfig } from "oxlint";

const DB_MESSAGE =
  'Go through @openstatus/services. Database access outside it is a defect; see AGENTS.md "Architecture".';

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
    // Database access goes through @openstatus/services; the override below
    // lists the places allowed to reach the client directly. Type imports
    // and schema sub-paths (zod schemas, enum constants) stay importable.
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@openstatus/db",
            allowTypeImports: true,
            message: DB_MESSAGE,
          },
          { name: "drizzle-orm", allowTypeImports: true, message: DB_MESSAGE },
        ],
        patterns: [
          {
            group: [
              "@openstatus/db/**",
              "!@openstatus/db/src/schema",
              "!@openstatus/db/src/schema/**",
              // Environment validation only; no client.
              "!@openstatus/db/env.mjs",
              "drizzle-orm/**",
            ],
            allowTypeImports: true,
            message: DB_MESSAGE,
          },
        ],
      },
    ],
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
    "**/drizzle/*/snapshot.json",
    "**/.content-collections/**",
    ".devbox/**",
    "**/*.astro",
  ],
  overrides: [
    {
      // Allowed to reach the database directly. Each entry carries its reason;
      // everything else imports @openstatus/services.
      files: [
        // The db package itself, tests, seeds and one-off scripts.
        "packages/db/**",
        "**/__tests__/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/test/**",
        "scripts/**",
        "apps/*/src/scripts/**",
        "packages/*/scripts/**",
        // Legacy REST API, scheduled for removal. Delete this line with it.
        "apps/server/src/routes/v1/**",
        // Infrastructure: health probes ping the client, and the Auth.js
        // adapters own the session tables.
        "apps/dashboard/src/app/api/health/route.ts",
        "apps/external-status/src/health.ts",
        "apps/server/src/routes/health.ts",
        "apps/status-page/src/app/api/health/route.ts",
        "apps/workflows/src/health.ts",
        "apps/dashboard/src/lib/auth/adapter.ts",
        "apps/status-page/src/lib/auth/adapter.ts",
        // Delivery library that services dispatches through: services depends
        // on it, so it cannot import services back.
        "packages/subscriptions/src/**",
        // The workflows client wiring, and the documented checker ingest batch
        // (see packages/services/AGENTS.md).
        "apps/workflows/src/lib/db.ts",
        "apps/workflows/src/checker/transition.ts",
      ],
      rules: { "no-restricted-imports": "off" },
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
      // Shape-triggered: any exported function taking `ctx: ServiceContext`
      // checks a scope first, whatever its name or folder.
      files: ["packages/services/src/**/*.ts"],
      excludeFiles: [
        "**/__tests__/**",
        "**/*.test.ts",
        "**/internal.ts",
        // The scope machinery itself: requireScope, transactions, features.
        "packages/services/src/auth/**",
        "packages/services/src/context.ts",
        "packages/services/src/features.ts",
      ],
      rules: {
        "openstatus/services-verbs-require-scope": "error",
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
