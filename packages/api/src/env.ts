import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    STRIPE_SECRET_KEY: z.string(),
    PROJECT_ID_VERCEL: z.string(),
    TEAM_ID_VERCEL: z.string(),
    VERCEL_AUTH_BEARER_TOKEN: z.string(),
    TINY_BIRD_API_KEY: z.string(),
    RESEND_API_KEY: z.string(),
  },

  runtimeEnv: {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    PROJECT_ID_VERCEL: process.env.PROJECT_ID_VERCEL,
    TEAM_ID_VERCEL: process.env.TEAM_ID_VERCEL,
    VERCEL_AUTH_BEARER_TOKEN: process.env.VERCEL_AUTH_BEARER_TOKEN,
    TINY_BIRD_API_KEY: process.env.TINY_BIRD_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  },
  skipValidation: process.env.NODE_ENV === "test",
});
