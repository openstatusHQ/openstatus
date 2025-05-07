import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    OPENPANEL_CLIENT_SECRET: z.string(),
  },
  client: {
    NEXT_PUBLIC_OPENPANEL_CLIENT_ID: z.string(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: {
    OPENPANEL_CLIENT_SECRET: process.env.OPENPANEL_CLIENT_SECRET,
    NEXT_PUBLIC_OPENPANEL_CLIENT_ID:
      process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID,
  },
});
