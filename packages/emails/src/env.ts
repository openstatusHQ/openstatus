import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    RESEND_API_KEY: z.string().min(1),
    EMAIL_FROM: z
      .string()
      .email()
      .prefault("notifications@notifications.openstatus.dev"),
    EMAIL_FROM_WELCOME: z.string().email().prefault("welcome@openstatus.dev"),
    EMAIL_FROM_FEEDBACK: z.string().email().prefault("thibault@openstatus.dev"),
    EMAIL_FROM_WELCOME_NAME: z.string().prefault("Thibault Le Ouay Ducasse"),
    EMAIL_FROM_FEEDBACK_NAME: z.string().prefault("Thibault Le Ouay Ducasse"),
    EMAIL_FROM_NAME: z.string().prefault("OpenStatus"),
  },
  runtimeEnv: {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_FROM_WELCOME: process.env.EMAIL_FROM_WELCOME,
    EMAIL_FROM_FEEDBACK: process.env.EMAIL_FROM_FEEDBACK,
    EMAIL_FROM_WELCOME_NAME: process.env.EMAIL_FROM_WELCOME_NAME,
    EMAIL_FROM_FEEDBACK_NAME: process.env.EMAIL_FROM_FEEDBACK_NAME,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
  },
});
