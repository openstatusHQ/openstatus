import { AsyncLocalStorage } from "node:async_hooks";
// import * as Sentry from "@sentry/node";
import { sentry } from "@hono/sentry";
import {
  configureSync,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
  withContext,
} from "@logtape/logtape";
import { getSentrySink } from "@logtape/sentry";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
// import { logger } from "hono/logger";
import { checkerRoute } from "./checker";
import { cronRouter } from "./cron";
import { env } from "./env";

const { NODE_ENV, PORT } = env();

configureSync({
  sinks: {
    console: getConsoleSink({ formatter: jsonLinesFormatter }),
    sentry: getSentrySink(),
  },
  loggers: [
    {
      category: "workflow",
      lowestLevel: "debug",
      sinks: ["console", "sentry"],
    },
  ],
  contextLocalStorage: new AsyncLocalStorage(),
});

const logger = getLogger(["workflow"]);
const app = new Hono({ strict: false });

app.use("*", sentry({ dsn: env().SENTRY_DSN }));

app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  await withContext(
    {
      requestId,
      method: c.req.method,
      url: c.req.url,
      userAgent: c.req.header("User-Agent"),
      // ipAddress: c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For")
    },
    async () => {
      logger.info("Request started", {
        method: c.req.method,
        url: c.req.url,
        requestId,
      });

      await next();

      const duration = Date.now() - startTime;
      logger.info("Request completed", {
        status: c.res.status,
        duration,
        requestId,
      });
    },
  );
});

app.onError((err, c) => {
  logger.error("Request error", {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    method: c.req.method,
    url: c.req.url,
  });
  c.get("sentry").captureException(err);

  return c.json({ error: "Internal server error" }, 500);
});

// app.use("/*", logger());

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

if (NODE_ENV === "development") {
  showRoutes(app, { verbose: true, colorize: true });
}

console.log(`Starting server on port ${PORT}`);

const server = { port: PORT, fetch: app.fetch };

export default server;
