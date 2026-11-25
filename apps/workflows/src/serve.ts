import { serve } from "@hono/node-server";
import { dispose, getLogger } from "@logtape/logtape";

import { shutdownOutbox, startOutboxConsumer } from "./checker/outbox";
import {
  drainScheduledTasks,
  startScheduler,
  stopScheduler,
} from "./cron/scheduler";
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
    // Same window shutdownOutbox gives in-flight sends, so both fit inside
    // Fly's kill_timeout with room left for the OTLP log flush.
    await Promise.all([
      shutdownOutbox(),
      drainScheduledTasks(env().NOTIFICATION_TIMEOUT_MS + 5_000),
    ]);
    await httpClosed;
    await dispose();
    process.exit(0);
  })();
});
