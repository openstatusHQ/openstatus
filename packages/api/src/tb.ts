import { OSTinybird } from "@openstatus/tinybird";

import { env } from "./env";

export const tb = new OSTinybird({
  token: env.TINY_BIRD_API_KEY,
  baseUrl: env.TINYBIRD_URL,
  noop: process.env.NODE_ENV === "test" ? true : env.TINYBIRD_NOOP,
});
