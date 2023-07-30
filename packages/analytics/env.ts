import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    JITSU_HOST: z.string(),
    JITSU_WRITE_KEY: z.string(),
  },
  runtimeEnv: {
    JITSU_HOST: process.env.JITSU_HOST,
    JITSU_WRITE_KEY: process.env.JITSU_WRITE_KEY,
  },
});
