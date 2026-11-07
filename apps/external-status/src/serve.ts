import { serve } from "@hono/node-server";
import { dispose, getLogger } from "@logtape/logtape";

import { env } from "./env";
import { app } from "./index";

const { NODE_ENV, PORT } = env();

const logger = getLogger(["external-status"]);

logger.info("Starting server", { port: PORT, environment: NODE_ENV });

const server = serve({ fetch: app.fetch, port: PORT });

process.once("SIGTERM", () => {
  void (async () => {
    logger.info("SIGTERM received, closing server");
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await dispose();
    process.exit(0);
  })();
});
