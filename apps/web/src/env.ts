import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import "@openstatus/analytics/env";
import "@openstatus/db/env.mjs";

export const env = createEnv({
  server: {
    TINY_BIRD_API_KEY: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
    QSTASH_NEXT_SIGNING_KEY: z.string().min(1),
    QSTASH_TOKEN: z.string().min(1),
    STRIPE_WEBHOOK_SECRET_KEY: z.string(),
    UNKEY_TOKEN: z.string(),
    UNKEY_API_ID: z.string(),
    GCP_PROJECT_ID: z.string(),
    GCP_LOCATION: z.string(),
    GCP_CLIENT_EMAIL: z.string(),
    GCP_PRIVATE_KEY: z.string(),
    CRON_SECRET: z.string(),
    EXTERNAL_API_URL: z.string().url(),
    CLICKHOUSE_URL: z.string(),
    CLICKHOUSE_USERNAME: z.string(),
    CLICKHOUSE_PASSWORD: z.string(),
    PAGERDUTY_APP_ID: z.string().optional(),
    SLACK_SUPPORT_WEBHOOK_URL: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string(),
    NEXT_PUBLIC_URL: z.string(),
    NEXT_PUBLIC_SENTRY_DSN: z.string(),
  },
  runtimeEnv: {
    TINY_BIRD_API_KEY: process.env.TINY_BIRD_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    STRIPE_WEBHOOK_SECRET_KEY: process.env.STRIPE_WEBHOOK_SECRET_KEY,
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    UNKEY_TOKEN: process.env.UNKEY_TOKEN,
    UNKEY_API_ID: process.env.UNKEY_API_ID,
    GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
    GCP_LOCATION: process.env.GCP_LOCATION,
    GCP_CLIENT_EMAIL: process.env.GCP_CLIENT_EMAIL,
    GCP_PRIVATE_KEY: process.env.GCP_PRIVATE_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    EXTERNAL_API_URL: process.env.EXTERNAL_API_URL,
    CLICKHOUSE_URL: process.env.CLICKHOUSE_URL,
    CLICKHOUSE_USERNAME: process.env.CLICKHOUSE_USERNAME,
    CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD,
    PAGERDUTY_APP_ID: process.env.PAGERDUTY_APP_ID,
    SLACK_SUPPORT_WEBHOOK_URL: process.env.SLACK_SUPPORT_WEBHOOK_URL,
  },
  skipValidation: true,
});
