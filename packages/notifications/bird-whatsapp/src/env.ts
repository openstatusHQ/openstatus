import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    BIRD_ACCESS_KEY: z.string(),
    BIRD_WORKSPACE_ID: z.string(),
    BIRD_CHANNEL_ID: z.string(),
  },
  runtimeEnv: process.env,
  skipValidation: true,
});
