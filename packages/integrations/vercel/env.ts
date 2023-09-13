import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    INTEGRATION_SECRET: z.string().min(1),
    TINY_BIRD_API_KEY: z.string().min(1),
  },
  runtimeEnv: {
    INTEGRATION_SECRET: process.env.INTEGRATION_SECRET,
    TINY_BIRD_API_KEY: process.env.TINY_BIRD_API_KEY,
  },
});
