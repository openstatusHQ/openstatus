import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // setupFiles: ["dotenv/config"], //this line,
    globals: true,
  },
  define: {
    "process.env.FLY_REGION": `"ams"`,
  },
});
