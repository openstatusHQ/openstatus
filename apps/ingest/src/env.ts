import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().default(3004),
    MAX_BODY_BYTES: z.coerce.number().default(1_048_576),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().default(600),
    DRAIN_INTERVAL_MS: z.coerce.number().default(5_000),
    SWEEP_INTERVAL_MS: z.coerce.number().default(300_000),
    RETENTION_INTERVAL_MS: z.coerce.number().default(3_600_000),
  },
  runtimeEnv: process.env,
  skipValidation: process.env.NODE_ENV === "test",
});
