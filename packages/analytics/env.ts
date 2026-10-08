import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * `NODE_ENV` is read through this alias rather than as a literal
 * `process.env.NODE_ENV` member access: `deno bundle` (esbuild) constant-folds
 * that exact expression into a string at build time — `"development"` unless
 * `--minify` is passed — which left `setupAnalytics` permanently no-op inside
 * the compiled `apps/server` binary. The other keys stay as literal member
 * accesses because Next.js needs them that way to inline `NEXT_PUBLIC_*`.
 */
const processEnv: Record<string, string | undefined> = process.env;

export const env = createEnv({
  server: {
    OPENPANEL_CLIENT_SECRET: z.string(),
    NODE_ENV: z.string().prefault("development"),
  },
  client: {
    NEXT_PUBLIC_OPENPANEL_CLIENT_ID: z.string(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: {
    OPENPANEL_CLIENT_SECRET: process.env.OPENPANEL_CLIENT_SECRET,
    NODE_ENV: processEnv.NODE_ENV,
    NEXT_PUBLIC_OPENPANEL_CLIENT_ID:
      process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID,
  },
  skipValidation: true,
});
