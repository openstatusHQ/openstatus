import { serve } from "@hono/node-server";
import { getLogger } from "@logtape/logtape";

import { shutdownOutbox, startOutboxConsumer } from "./checker/outbox";
import { startScheduler, stopScheduler } from "./cron/scheduler";
import { env } from "./env";
import { app } from "./index";

const { NODE_ENV, PORT } = env();

const logger = getLogger(["workflow"]);

logger.info("Starting server", {
  port: PORT,
  environment: NODE_ENV,
});

startOutboxConsumer();
startScheduler();

const server = serve({ fetch: app.fetch, port: PORT });

process.on("SIGTERM", () => {
  void (async () => {
    logger.info("SIGTERM received, releasing outbox claims");
    await stopScheduler();
    await shutdownOutbox();
    server.close();
  })();
});
