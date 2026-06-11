import { defineConfig } from "oxfmt";

// Mirrors the previous Biome formatter profile (all-defaults except width 80).
export default defineConfig({
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  arrowParens: "always",
  sortImports: true,
  sortPackageJson: true,
  sortTailwindcss: { functions: ["cn", "cva", "clsx"] },
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
    // CSS/MD/YAML/etc deferred to a follow-up PR — keep scope to JS/TS/JSON.
    "**/*.{css,scss,less,md,mdx,yaml,yml,html,graphql,gql,vue,svelte,toml}",
  ],
});
