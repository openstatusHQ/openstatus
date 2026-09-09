/// <reference lib="deno.ns" />

import {
  configure,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
} from "@logtape/logtape";
import * as Sentry from "@sentry/deno";

import { env } from "./env";
import { startScheduler, stopScheduler } from "./inbox/scheduler";
import { app } from "./index";

await configure({
  sinks: { console: getConsoleSink({ formatter: jsonLinesFormatter }) },
  loggers: [
    { category: "ingest", lowestLevel: "info", sinks: ["console"] },
    {
      category: ["logtape", "meta"],
      lowestLevel: "warning",
      sinks: ["console"],
    },
  ],
});

const SENTRY_DSN = Deno.env.get("SENTRY_DSN");
if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN, environment: env.NODE_ENV });
}

const logger = getLogger(["ingest"]);

logger.info("Starting ingest", { port: env.PORT, environment: env.NODE_ENV });

startScheduler();

const server = Deno.serve({ port: env.PORT }, app.fetch);

Deno.addSignalListener("SIGTERM", () => {
  void (async () => {
    logger.info("SIGTERM received, releasing inbox claims");
    await stopScheduler();
    await server.shutdown();
  })();
});
