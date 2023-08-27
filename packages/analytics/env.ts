import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    JITSU_HOST: z.string().optional(),
    JITSU_WRITE_KEY: z.string().optional(),
  },
  runtimeEnv: {
    JITSU_HOST: process.env.JITSU_HOST,
    JITSU_WRITE_KEY: process.env.JITSU_WRITE_KEY,
  },
});
