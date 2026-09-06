/// <reference lib="deno.ns" />

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

const server = Deno.serve({ port: PORT }, app.fetch);

Deno.addSignalListener("SIGTERM", () => {
  void (async () => {
    logger.info("SIGTERM received, releasing outbox claims");
    await stopScheduler();
    await shutdownOutbox();
    await server.shutdown();
  })();
});
