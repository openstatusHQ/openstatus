import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["eslint", "typescript", "react", "unicorn", "oxc"],
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
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
    ],
    "typescript/no-explicit-any": "error",
    "typescript/no-non-null-assertion": "error",
    "react/no-danger": "error",
    "react/exhaustive-deps": "warn",
    "unicorn/prefer-node-protocol": "error",
  },
  ignorePatterns: [
    "packages/ui/src/components/*.ts",
    "packages/ui/src/components/*.tsx",
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
      // Ban @openstatus/db + drizzle imports in layers migrated onto
      // @openstatus/services. Scope grows one domain per migration PR.
      files: [
        "packages/api/src/router/statusReport.ts",
        "packages/api/src/router/maintenance.ts",
        "packages/api/src/router/incident.ts",
        "packages/api/src/router/monitor.ts",
        "packages/api/src/router/pageComponent.ts",
        "packages/api/src/router/page.ts",
        "packages/api/src/router/workspace.ts",
        "packages/api/src/router/user.ts",
        "packages/api/src/router/invitation.ts",
        "packages/api/src/router/apiKey.ts",
        "packages/api/src/router/import.ts",
        "apps/server/src/routes/rpc/handlers/health/**",
        "apps/server/src/routes/rpc/handlers/status-report/**",
        "apps/server/src/routes/rpc/handlers/maintenance/**",
        "apps/server/src/routes/rpc/handlers/notification/**",
        "apps/server/src/routes/slack/interactions.ts",
      ],
      excludeFiles: [
        "**/__tests__/**",
        "**/*.test.ts",
        // Still read db directly: limits.ts queries quotas, converters.ts needs
        // db enum shapes for proto round-trip. Exempt until they move to services.
        "apps/server/src/routes/rpc/handlers/notification/limits.ts",
        "apps/server/src/routes/rpc/handlers/notification/converters.ts",
      ],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "@openstatus/db",
                message:
                  "Use @openstatus/services instead (domain has migrated to the service layer).",
              },
              {
                name: "@openstatus/db/src/schema",
                message: "Use @openstatus/services instead.",
              },
              {
                name: "@openstatus/db/src/schema/plan/utils",
                message: "Use @openstatus/services instead.",
              },
              {
                name: "@openstatus/db/src/schema/plan/schema",
                message: "Use @openstatus/services instead.",
              },
              {
                name: "@openstatus/db/src/schema/plan/config",
                message: "Use @openstatus/services instead.",
              },
              {
                name: "drizzle-orm",
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
  ],
});
