import { configureSync, getConsoleSink, getLogger } from "@logtape/logtape";
import { getSentrySink } from "@logtape/sentry";
import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { logger } from "hono/logger";
import { checkerRoute } from "./checker";
import { cronRouter } from "./cron";
import { env } from "./env";

const { NODE_ENV, PORT } = env();

Sentry.init({
  dsn: env().SENTRY_DSN,
});


configureSync({
  sinks: { console: getConsoleSink(), sentry: getSentrySink()},
  loggers: [
    {
      category: "workflow",
      lowestLevel: "debug",
      sinks: ["console", "sentry"],
    },
  ],
});

const log = getLogger(["workflow"]);
const app = new Hono({ strict: false }) // Add an onError hook to report unhandled exceptions to Sentry.
  .onError((err, c) => {
    // Report _all_ unhandled errors.
    Sentry.captureException(err);
    return c.text("Internal Server Error", 500);
  });

// app.use("*", sentry({ dsn: env().SENTRY_DSN }));

app.use("/*", logger());

app.get("/", (c) => c.text("workflows", 200));

/**
 * Ping Pong
 */
app.get("/ping", (c) => c.json({ ping: "pong" }, 200));

/**
 * Cron Routes
 */
app.route("/cron", cronRouter);

app.route("/", checkerRoute);

app.get("/debug-sentry", () => {
  console.log("test");
  console.error("something strange");
  log.info("test info");
  log.error("test error");
  throw new Error("My first Sentry error!");
});

if (NODE_ENV === "development") {
  showRoutes(app, { verbose: true, colorize: true });
}

console.log(`Starting server on port ${PORT}`);

const server = { port: PORT, fetch: app.fetch };

export default server;
