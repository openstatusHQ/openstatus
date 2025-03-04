import { z } from "zod";

export const env = () =>
  z
    .object({
      NODE_ENV: z.string().default("development"),
      PORT: z.coerce.number().default(3000),
      GCP_PROJECT_ID: z.string().default(""),
      GCP_CLIENT_EMAIL: z.string().default(""),
      GCP_PRIVATE_KEY: z.string().default(""),
      GCP_LOCATION: z.string().default("europe-west1"),
      CRON_SECRET: z.string().default(""),
      SITE_URL: z.string().default("http://localhost:3000"),
      DATABASE_URL: z.string().default("http://localhost:8080"),
      DATABASE_AUTH_TOKEN: z.string().default(""),
      RESEND_API_KEY: z.string().default(""),
      TINY_BIRD_API_KEY: z.string().default(""),
    })
    .parse(process.env);
