import { AsyncLocalStorage } from "node:async_hooks";

import { sentry } from "@hono/sentry";
import {
  configure,
  // configureSync,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
  withContext,
} from "@logtape/logtape";
import { getOpenTelemetrySink } from "@logtape/otel";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";

import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions/incubating";
import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";
import { env } from "./env";
import { handleError } from "./libs/errors";
import { publicRoute } from "./routes/public";
import { api } from "./routes/v1";

type Env = {
  Variables: {
    event: Record<string, unknown>;
  };
};

const defaultLogger = getOpenTelemetrySink({
  serviceName: "openstatus-server",
  otlpExporterConfig: {
    url: "https://eu-central-1.aws.edge.axiom.co/v1/logs",
    headers: {
      Authorization: `Bearer ${env.AXIOM_TOKEN}`,
      "X-Axiom-Dataset": env.AXIOM_DATASET,
    },
  },
  additionalResource: resourceFromAttributes({
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: env.NODE_ENV,
  }),
});

await configure({
  sinks: {
    console: getConsoleSink({ formatter: jsonLinesFormatter }),

    otel: defaultLogger,
  },
  loggers: [
    {
      category: "api-server",
      lowestLevel: "error",
      sinks: ["console"],
    },
    {
      category: "api-server-otel",
      lowestLevel: "info",
      sinks: ["otel"],
    },
  ],
  contextLocalStorage: new AsyncLocalStorage(),
});

const logger = getLogger("api-server");

const otelLogger = getLogger("api-server-otel");

export const app = new Hono<Env>({
  strict: false,
});

/**
 * Middleware
 */
app.use("*", sentry({ dsn: process.env.SENTRY_DSN }));
app.use("*", requestId());
app.use("*", prettyJSON());

app.use("*", async (c, next) => {
  const requestId = c.get("requestId");
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

      const event: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
      };
      c.set("event", event);
      await next();

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

      const duration = Date.now() - startTime;

      event.duration_ms = duration;
      otelLogger.info("request completed", { ...event });
      logger.info("Request completed", {
        status: c.res.status,
        duration,
        requestId,
      });
    },
  );
});

app.onError(handleError);

/**
 * Public Routes
 */
app.route("/public", publicRoute);

/**
 * Ping Pong
 */
app.get("/ping", (c) => {
  return c.json(
    { ping: "pong", region: env.FLY_REGION, requestId: c.get("requestId") },
    200,
  );
});

/**
 * API Routes v1
 */
app.route("/v1", api);

/**
 * TODO: move to `workflows` app
 * This route is used by our checker to update the status of the monitors,
 * create incidents, and send notifications.
 */

const isDev = process.env.NODE_ENV === "development";
const port = 3000;

if (isDev) showRoutes(app, { verbose: true, colorize: true });

console.log(`Starting server on port ${port}`);

const server = { port, fetch: app.fetch };

export default server;
