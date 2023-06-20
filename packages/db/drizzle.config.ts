import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  connectionString: process.env.DATABASE_URL || "",
} satisfies Config;