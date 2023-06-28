/** @type {import("eslint").Linter.Config} */
const config = {
  root: true,
  extends: ["@openstatus"], // uses the config in `packages/config/eslint`
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    tsconfigRootDir: __dirname,
    project: [
      "./apps/*/tsconfig.json",
      "./packages/*/tsconfig.json",
    ],
  },
  settings: {
    next: {
      rootDir: ["apps/*/"],
    },
  },
};

module.exports = config;