import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Parse SELF_HOST using z.stringbool() to ensure consistency with the schema
const isSelfHost = z.stringbool().catch(false).parse(process.env.SELF_HOST);

export const env = createEnv({
  server: {
    STRIPE_SECRET_KEY: isSelfHost ? z.string().optional() : z.string(),
    PROJECT_ID_VERCEL: isSelfHost ? z.string().optional() : z.string(),
    TEAM_ID_VERCEL: isSelfHost ? z.string().optional() : z.string(),
    VERCEL_AUTH_BEARER_TOKEN: isSelfHost ? z.string().optional() : z.string(),
    TINY_BIRD_API_KEY: isSelfHost ? z.string().optional() : z.string(),
    TINYBIRD_URL: z.string().default("https://api.tinybird.co"),
    CHECKER_URL: z.url().default("https://openstatus-checker.fly.dev"),
    TINYBIRD_NOOP: z.stringbool().catch(false),
    RESEND_API_KEY: z.string(),
    CRON_SECRET: z.string(),
    UNKEY_TOKEN: isSelfHost ? z.string().optional() : z.string(),
    UNKEY_API_ID: isSelfHost ? z.string().optional() : z.string(),
    SLACK_FEEDBACK_WEBHOOK_URL: z.string().optional(),
    EXTERNAL_REPORT_SALT: z.string().optional(),
    SELF_HOST: z.stringbool().prefault("false"),
  },

  runtimeEnv: {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    PROJECT_ID_VERCEL: process.env.PROJECT_ID_VERCEL,
    TEAM_ID_VERCEL: process.env.TEAM_ID_VERCEL,
    VERCEL_AUTH_BEARER_TOKEN: process.env.VERCEL_AUTH_BEARER_TOKEN,
    TINY_BIRD_API_KEY: process.env.TINY_BIRD_API_KEY,
    TINYBIRD_URL: process.env.TINYBIRD_URL,
    CHECKER_URL: process.env.CHECKER_URL,
    TINYBIRD_NOOP: process.env.TINYBIRD_NOOP,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    UNKEY_TOKEN: process.env.UNKEY_TOKEN,
    UNKEY_API_ID: process.env.UNKEY_API_ID,
    SLACK_FEEDBACK_WEBHOOK_URL: process.env.SLACK_FEEDBACK_WEBHOOK_URL,
    EXTERNAL_REPORT_SALT: process.env.EXTERNAL_REPORT_SALT,
    SELF_HOST: process.env.SELF_HOST,
  },
  skipValidation: process.env.NODE_ENV === "test",
});
