import { z } from "zod";

export const env = () =>
  z
    .object({
      NODE_ENV: z.string().prefault("development"),
      PORT: z.coerce.number().prefault(3000),
      GCP_PROJECT_ID: z.string().prefault(""),
      GCP_CLIENT_EMAIL: z.string().prefault(""),
      GCP_PRIVATE_KEY: z.string().prefault(""),
      GCP_LOCATION: z.string().prefault("europe-west1"),
      CRON_SECRET: z.string().prefault(""),
      SITE_URL: z.string().prefault("http://localhost:3000"),
      DATABASE_URL: z.string().prefault("http://localhost:8080"),
      DATABASE_AUTH_TOKEN: z.string().prefault(""),
      RESEND_API_KEY: z.string().prefault(""),
      TINY_BIRD_API_KEY: z.string().prefault(""),
      QSTASH_TOKEN: z.string().prefault(""),
      SCREENSHOT_SERVICE_URL: z.string().prefault(""),
      TWILLIO_AUTH_TOKEN: z.string().prefault(""),
      TWILLIO_ACCOUNT_ID: z.string().prefault(""),
      SENTRY_DSN: z.string().prefault(""),
      AXIOM_TOKEN: z.string().prefault(""),
      AXIOM_DATASET: z.string().prefault(""),
    })
    .parse(process.env);
