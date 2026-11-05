import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * `NODE_ENV` is read through this alias rather than as a literal
 * `process.env.NODE_ENV` member access, which some bundlers fold into a
 * build-time string; the alias keeps it a runtime value.
 */
const processEnv: Record<string, string | undefined> = process.env;

export const env = createEnv({
  server: {
    RESEND_API_KEY: z.string().min(1),
    NODE_ENV: z.string().prefault("development"),
  },
  runtimeEnv: {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NODE_ENV: processEnv.NODE_ENV,
  },
});
