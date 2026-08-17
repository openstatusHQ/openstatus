import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    DATABASE_AUTH_TOKEN: z.string().min(1),
    CLICKHOUSE_URL: z.string(),
    CLICKHOUSE_USERNAME: z.string(),
    CLICKHOUSE_PASSWORD: z.string(),
  },
  runtimeEnv: {
    // Tests fall back to the conventional local sqld port, but an explicit
    // DATABASE_URL always wins so each suite can target its own database.
    DATABASE_URL:
      process.env.DATABASE_URL ??
      (process.env.NODE_ENV === "test" ? "http://127.0.0.1:8080" : undefined),
    DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN,
    CLICKHOUSE_URL: process.env.CLICKHOUSE_URL,
    CLICKHOUSE_USERNAME: process.env.CLICKHOUSE_USERNAME,
    CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD,
  },
  skipValidation: true,
});
