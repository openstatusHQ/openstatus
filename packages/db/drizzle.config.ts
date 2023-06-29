import "dotenv/config";

import type { Config } from "drizzle-kit";

import { env } from "./env.mjs";

export default {
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    connectionString: env.DATABASE_URL,
  },
} satisfies Config;
