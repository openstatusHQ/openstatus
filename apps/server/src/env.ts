import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { flyRegions } from "@openstatus/utils";

export const env = createEnv({
  server: {
    UNKEY_API_ID: z.string().min(1),
    UNKEY_TOKEN: z.string().min(1),
    TINY_BIRD_API_KEY: z.string().min(1),
    UPSTASH_REDIS_REST_URL: z.string().min(1),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    FLY_REGION: z.enum(flyRegions),
    CRON_SECRET: z.string(),
    JITSU_WRITE_KEY: z.string().optional(),
    JITSU_HOST: z.string().optional(),
  },

  /**
   * What object holds the environment variables at runtime. This is usually
   * `process.env` or `import.meta.env`.
   */
  runtimeEnv: process.env,

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  skipValidation: true,
});
