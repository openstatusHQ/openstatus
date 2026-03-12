import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import "@openstatus/analytics/env";
import "@openstatus/db/env.mjs";

export const env = createEnv({
  server: {
    TINY_BIRD_API_KEY: z.string().default(""),
    RESEND_API_KEY: z.string().default(""),
    QSTASH_CURRENT_SIGNING_KEY: z.string().default(""),
    QSTASH_NEXT_SIGNING_KEY: z.string().default(""),
    QSTASH_TOKEN: z.string().default(""),
    STRIPE_WEBHOOK_SECRET_KEY: z.string().default(""),
    UNKEY_TOKEN: z.string().default(""),
    UNKEY_API_ID: z.string().default(""),
    GCP_PROJECT_ID: z.string().default(""),
    GCP_LOCATION: z.string().default(""),
    GCP_CLIENT_EMAIL: z.string().default(""),
    GCP_PRIVATE_KEY: z.string().default(""),
    CRON_SECRET: z.string().default(""),
    EXTERNAL_API_URL: z.string().default("http://localhost:3000"),
    CLICKHOUSE_URL: z.string().default(""),
    CLICKHOUSE_USERNAME: z.string().default(""),
    CLICKHOUSE_PASSWORD: z.string().default(""),
    PAGERDUTY_APP_ID: z.string().default(""),
    SLACK_SUPPORT_WEBHOOK_URL: z.string().default(""),
  },
  client: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default(""),
    NEXT_PUBLIC_URL: z.string().default("http://localhost:3000"),
    NEXT_PUBLIC_SENTRY_DSN: z.string().default(""),
    NEXT_PUBLIC_OPENPANEL_CLIENT_ID: z.string().default(""),
  },
  runtimeEnv: {
    NEXT_PUBLIC_OPENPANEL_CLIENT_ID:
      process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID,
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
