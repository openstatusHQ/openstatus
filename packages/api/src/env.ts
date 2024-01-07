import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    STRIPE_SECRET_KEY: z.string(),
    PROJECT_ID_VERCEL: z.string(),
    TEAM_ID_VERCEL: z.string(),
    VERCEL_AUTH_BEARER_TOKEN: z.string(),
  },

  runtimeEnv: {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    PROJECT_ID_VERCEL: process.env.PROJECT_ID_VERCEL,
    TEAM_ID_VERCEL: process.env.TEAM_ID_VERCEL,
    VERCEL_AUTH_BEARER_TOKEN: process.env.VERCEL_AUTH_BEARER_TOKEN,
  },
  skipValidation: process.env.NODE_ENV === "test",
});
