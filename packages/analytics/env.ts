import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    OPENPANEL_CLIENT_ID: z.string(),
    OPENPANEL_CLIENT_SECRET: z.string(),
  },
  runtimeEnv: {
    OPENPANEL_CLIENT_ID: process.env.OPENPANEL_CLIENT_ID,
    OPENPANEL_CLIENT_SECRET: process.env.OPENPANEL_CLIENT_SECRET,
  },
});
