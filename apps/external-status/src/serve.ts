import { serve } from "@hono/node-server";
import { dispose, getLogger } from "@logtape/logtape";
import * as Sentry from "@sentry/node";

import { env } from "./env";
import { app } from "./index";
import { drainBackground } from "./lib/background";

const { NODE_ENV, PORT } = env();

// Stays under fly.toml's kill_timeout, with room for the Sentry and log flush.
const DRAIN_GRACE_MS = 80_000;

const logger = getLogger(["external-status"]);

logger.info("Starting server", { port: PORT, environment: NODE_ENV });

const server = serve({ fetch: app.fetch, port: PORT });

process.once("SIGTERM", () => {
  void (async () => {
    logger.info("SIGTERM received, draining in-flight ticks");
    const httpClosed = new Promise<void>((resolve) =>
      server.close(() => resolve()),
    );
    await drainBackground(DRAIN_GRACE_MS);
    await httpClosed;
    await Sentry.flush(2_000);
    await dispose();
    process.exit(0);
  })();
});
