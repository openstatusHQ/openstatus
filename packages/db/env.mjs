import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1).optional(),
    DATABASE_AUTH_TOKEN: z.string().min(1).optional(),
    CLICKHOUSE_URL: z.string().optional(),
    CLICKHOUSE_USERNAME: z.string().optional(),
    CLICKHOUSE_PASSWORD: z.string().optional(),
  },
  runtimeEnv: {
    DATABASE_URL:
      // FIXME: This is a hack to get the tests to run
      process.env.NODE_ENV === "test"
        ? "http://127.0.0.1:8080"
        : process.env.DATABASE_URL || "http://127.0.0.1:8080",
    DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN || "default-token",
    CLICKHOUSE_URL: process.env.CLICKHOUSE_URL || "",
    CLICKHOUSE_USERNAME: process.env.CLICKHOUSE_USERNAME || "",
    CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD || "",
  },
  skipValidation: true,
});
