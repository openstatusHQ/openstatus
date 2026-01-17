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
import { getOpenTelemetrySink } from "@logtape/otel";

// import { getSentrySink } from "@logtape/sentry";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { requestId } from "hono/request-id";
// import { logger } from "hono/logger";
import { checkerRoute } from "./checker";
import { cronRouter } from "./cron";
import { env } from "./env";

import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions/incubating";

const { NODE_ENV, PORT } = env();

type Env = {
  Variables: {
    event: Record<string, unknown>;
  };
};

function shouldSample(event: Record<string, any>): boolean {
  // Always keep errors
  if (event.status_code >= 500) return true;
  if (event.error) return true;

  // Always keep slow requests (above p99)
  if (event.duration_ms > 2000) return true;

  // Random sample the rest at 5%
  return Math.random() < 0.05;
}

const defaultLogger = getOpenTelemetrySink({
  serviceName: "openstatus-server",
  otlpExporterConfig: {
    url: "https://eu-central-1.aws.edge.axiom.co/v1/logs",
    headers: {
      Authorization: `Bearer ${env().AXIOM_TOKEN}`,
      "X-Axiom-Dataset": env().AXIOM_DATASET,
    },
  },
  additionalResource: resourceFromAttributes({
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: env().NODE_ENV,
  }),
});

configureSync({
  sinks: {
    console: getConsoleSink({ formatter: jsonLinesFormatter }),
    // sentry: getSentrySink(),
    otel: defaultLogger,
  },
  loggers: [
    {
      category: "workflow",
      lowestLevel: "debug",
      sinks: ["console"],
    },
    {
      category: "workflow-otel",
      lowestLevel: "info",
      sinks: ["otel"],
    },
  ],
  contextLocalStorage: new AsyncLocalStorage(),
});

const logger = getLogger(["workflow"]);
const otelLogger = getLogger(["workflow-otel"]);

const app = new Hono<Env>({ strict: false });

app.use("*", requestId());

app.use("*", sentry({ dsn: env().SENTRY_DSN }));

app.use("*", async (c, next) => {
  const requestId = c.get("requestId");
  const startTime = Date.now();

  const event: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };
  c.set("event", event);

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

      event.status_code = c.res.status;
      if (c.error) {
        event.outcome = "error";
        event.error = {
          type: c.error.name,
          message: c.error.message,
          stack: c.error.stack,
        };
      } else {
        event.outcome = "success";
      }
      event.duration_ms = duration;
      if (shouldSample(event)) {
        otelLogger.info("request completed", { ...event });
      }
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
