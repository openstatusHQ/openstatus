import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    OPENPANEL_CLIENT_SECRET: z.string(),
  },
  client: {
    NEXT_PUBLIC_OPENPANEL_CLIENT_ID: z.string(),
  },
  clientPrefix: "NEXT_PUBLIC_",

  runtimeEnv: process.env,

  skipValidation: true,

  // runtimeEnv: process.env,
});
