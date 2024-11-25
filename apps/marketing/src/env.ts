import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    TINY_BIRD_API_KEY: z.string().min(1),
    CRON_SECRET: z.string(),
    EXTERNAL_API_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_URL: z.string(),
    NEXT_PUBLIC_SENTRY_DSN: z.string(),
  },
  runtimeEnv: {
    TINY_BIRD_API_KEY: process.env.TINY_BIRD_API_KEY,
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    CRON_SECRET: process.env.CRON_SECRET,
    EXTERNAL_API_URL: process.env.EXTERNAL_API_URL,
  },
  skipValidation: true,
});
