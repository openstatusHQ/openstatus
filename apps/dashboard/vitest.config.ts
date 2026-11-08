import { defineTestConfig } from "@openstatus/test-utils/vitest";

export default defineTestConfig(import.meta.dirname, {
  importMap: "test.importmap.json",
  include: ["src/**/*.test.{ts,tsx}"],
});
