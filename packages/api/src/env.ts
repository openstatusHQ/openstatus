import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    STRIPE_SECRET_KEY: z.string().default(""),
    PROJECT_ID_VERCEL: z.string().default(""),
    TEAM_ID_VERCEL: z.string().default(""),
    VERCEL_AUTH_BEARER_TOKEN: z.string().default(""),
    TINY_BIRD_API_KEY: z.string().default(""),
    RESEND_API_KEY: z.string().default(""),
    CRON_SECRET: z.string().default(""),
    UNKEY_TOKEN: z.string().default(""),
    UNKEY_API_ID: z.string().default(""),
    SLACK_FEEDBACK_WEBHOOK_URL: z.string().default(""),
  },

  runtimeEnv: {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    PROJECT_ID_VERCEL: process.env.PROJECT_ID_VERCEL,
    TEAM_ID_VERCEL: process.env.TEAM_ID_VERCEL,
    VERCEL_AUTH_BEARER_TOKEN: process.env.VERCEL_AUTH_BEARER_TOKEN,
    TINY_BIRD_API_KEY: process.env.TINY_BIRD_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    UNKEY_TOKEN: process.env.UNKEY_TOKEN,
    UNKEY_API_ID: process.env.UNKEY_API_ID,
    SLACK_FEEDBACK_WEBHOOK_URL: process.env.SLACK_FEEDBACK_WEBHOOK_URL,
  },
  skipValidation: true,
});
