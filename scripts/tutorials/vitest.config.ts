import { defineTestConfig } from "@openstatus/test-utils/vitest";

export default defineTestConfig(import.meta.dirname, {
  include: ["lib/**/*.test.mjs"],
});
