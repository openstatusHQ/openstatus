import { getLogger } from "@logtape/logtape";

import { env } from "./env";
import { app } from "./index";

const port = 3000;

getLogger("api-server").info("Starting server", {
  port,
  environment: env.NODE_ENV,
});

Deno.serve({ port }, app.fetch);
