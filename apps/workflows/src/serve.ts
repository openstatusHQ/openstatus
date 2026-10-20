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

process.once("SIGTERM", () => {
  void (async () => {
    logger.info("SIGTERM received, releasing outbox claims");
    const httpClosed = new Promise<void>((resolve) =>
      server.close(() => resolve()),
    );
    await stopScheduler();
    await shutdownOutbox();
    await httpClosed;
    process.exit(0);
  })();
});
