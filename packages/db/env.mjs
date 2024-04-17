import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    DATABASE_AUTH_TOKEN: z.string().min(1),
  },
  runtimeEnv: {
    DATABASE_URL:
      // FIXME: This is a hack to get the tests to run
      process.env.NODE_ENV === "test"
        ? "http://127.0.0.1:8080"
        : process.env.DATABASE_URL,
    DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN,
  },
  skipValidation: true,
});
