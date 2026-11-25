import { setTimeout as sleep } from "node:timers/promises";

import { serve } from "@hono/node-server";
import { dispose, getLogger } from "@logtape/logtape";

import { env } from "./env";
import { app } from "./index";
import { settleBackgroundTasks } from "./libs/background";
import { heartbeatBatcher } from "./routes/heartbeat";

const port = 3000;

// Leaves headroom under Fly's kill_timeout (30s) for the OTLP log flush.
const SHUTDOWN_GRACE_MS = 20_000;

// Node terminates the process on unhandled rejections; log instead so one
// stray background promise (e.g. a fire-and-forget fetch) can't kill the instance.
process.on("unhandledRejection", (reason) => {
  getLogger("api-server").error("Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

getLogger("api-server").info("Starting server", {
  port,
  environment: env.NODE_ENV,
});

const server = serve({ fetch: app.fetch, port });

// Fly sends kill_signal (SIGTERM, see fly.toml) on deploy and stop, then
// SIGKILLs after kill_timeout. Stop accepting connections, let in-flight
// requests and the background work they started (Slack acks, see
// runInBackground) finish, send buffered heartbeat pings to Tinybird, then
// flush buffered OTLP logs before exiting.
process.once("SIGTERM", () => {
  void (async () => {
    getLogger("api-server").info("SIGTERM received, draining connections");
    const drained = (async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      // After the HTTP drain: a request finishing late can still spawn a task.
      await settleBackgroundTasks();
      // Last: a late ping still lands in the buffer. Bounded by the race below,
      // which cuts a batch still retrying against a Tinybird outage.
      await heartbeatBatcher.flush();
    })();
    await Promise.race([drained, sleep(SHUTDOWN_GRACE_MS)]);
    await dispose();
    process.exit(0);
  })();
});
