import { AsyncLocalStorage } from "node:async_hooks";
// import * as Sentry from "@sentry/node";
import { sentry } from "@hono/sentry";
import {
  configure,
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

export type Env = {
  Variables: {
    event: Record<string, unknown>;
  };
};

/**
 * Tail sampling strategy based on loggingsucks.com best practices
 * Makes sampling decisions post-request completion to capture:
 * - All errors (5xx status codes, explicit errors)
 * - Slow requests (above p99 threshold)
 * - Client errors (4xx) at higher rate than successful requests
 * - Random sample of remaining successful, fast requests
 */
function shouldSample(event: Record<string, unknown>): boolean {
  const statusCode = event.status_code as number | undefined;
  const durationMs = event.duration_ms as number | undefined;

  // Always capture: server errors
  if (statusCode && statusCode >= 500) return true;

  // Always capture: explicit errors
  if (event.error) return true;

  // Always capture: slow requests (above p99 - 2s threshold)
  if (durationMs && durationMs > 2000) return true;

  // Higher sampling for client errors (4xx) - 50%
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return true;
  }

  // Random sample successful, fast requests at 20%
  return Math.random() < 0.2;
}

const defaultLogger = getOpenTelemetrySink({
  serviceName: "openstatus-workflows",
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

await configure({
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
      request_id: requestId,
      method: c.req.method,
      url: c.req.url,
      user_agent: c.req.header("User-Agent"),
      // ipAddress: c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For")
    },
    async () => {
      // Build wide event context at request start
      event.request_id = requestId;
      event.method = c.req.method;
      event.path = c.req.path;
      event.url = c.req.url;
      event.user_agent = c.req.header("User-Agent");
      event.content_type = c.req.header("Content-Type");
      event.cf_ray = c.req.header("CF-Ray");
      event.cf_connecting_ip = c.req.header("CF-Connecting-IP");

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
      // Emit canonical log line with all context (wide event pattern)
      if (shouldSample(event)) {
        otelLogger.info("request", event);
      }
      logger.debug("Request completed", {
        status_code: c.res.status,
        duration_ms: duration,
        request_id: requestId,
      });
    },
  );
});

app.onError((err, c) => {
  logger.error("Unhandled request error", {
    error_name: err.name,
    error_message: err.message,
    error_stack: err.stack,
    method: c.req.method,
    path: c.req.path,
    url: c.req.url,
    request_id: c.get("requestId"),
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

logger.info("Starting server", { port: PORT, environment: NODE_ENV });

const server = { port: PORT, fetch: app.fetch };

export default server;
