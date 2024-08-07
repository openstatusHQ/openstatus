import type { Config } from "drizzle-kit";

import { env } from "./env.mjs";

export default {
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN,
  },
  driver: "turso",
  strict: true,
  dialect: "sqlite",
} satisfies Config;
