import { z } from "zod";

export const env = () =>
  z
    .object({
      NODE_ENV: z.string().prefault("development"),
      PORT: z.coerce.number().prefault(3000),
      CRON_SECRET: z.string().prefault(""),
      DATABASE_URL: z.string().prefault("http://localhost:8080"),
      DATABASE_AUTH_TOKEN: z.string().prefault(""),
      TINY_BIRD_API_KEY: z.string().prefault(""),
      TINYBIRD_URL: z.string().prefault("https://api.tinybird.co"),
      TINYBIRD_NOOP: z.stringbool().catch(false),
      SENTRY_DSN: z.string().prefault(""),
      AXIOM_TOKEN: z.string().prefault(""),
      AXIOM_DATASET: z.string().prefault(""),
    })
    .parse(process.env);
