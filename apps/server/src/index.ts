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
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions/incubating";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";

import { env } from "./env";
import { handleError } from "./libs/errors";
import { concurrencyGuard } from "./libs/middlewares/concurrency";
import { limits } from "./libs/middlewares/limits";
import { rateLimit } from "./libs/middlewares/rate-limit";
import { shouldSample } from "./libs/sampling";
import { createHealthRoute } from "./routes/health";
import { probesFromEnv } from "./routes/health/probes";
import { mcpRoute } from "./routes/mcp";
import { createOAuthRoutes } from "./routes/oauth";
import { oauthConfigFromEnv } from "./routes/oauth/config";
import { openapiRoute } from "./routes/openapi";
import { publicRoute } from "./routes/public";
import { mountRpcRoutes } from "./routes/rpc";
import { slackRoute } from "./routes/slack";
import { api } from "./routes/v1";

type Env = {
  Variables: {
    event: Record<string, unknown>;
  };
};

// Export app before any top-level await to avoid "Cannot access before initialization" errors in tests
export const app = new Hono<Env>({
  strict: false,
});

const logger = getLogger("api-server");
const otelLogger = getLogger("api-server-otel");

/**
 * Configure logging asynchronously without blocking module initialization.
 * This allows tests to import `app` immediately.
 */

// Build the LoggerProvider with a static OTLP exporter import so `deno bundle`
// includes it. Letting @logtape/otel create the exporter triggers a dynamic
// import of a bare specifier, which the compiled --node-modules-dir=none binary
// can't resolve.
const loggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "openstatus-server",
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: env.NODE_ENV,
  }),
  processors: [
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: "https://eu-central-1.aws.edge.axiom.co/v1/logs",
        headers: {
          Authorization: `Bearer ${env.AXIOM_TOKEN}`,
          "X-Axiom-Dataset": env.AXIOM_DATASET,
        },
      }),
    ),
  ],
});

const defaultLogger = getOpenTelemetrySink({
  loggerProvider,
});

await configure({
  sinks: {
    console: getConsoleSink({ formatter: jsonLinesFormatter }),
    otel: defaultLogger,
  },
  loggers: [
    {
      category: "api-server",
      lowestLevel: "info",
      sinks: ["console"],
    },
    {
      category: "api-server-otel",
      lowestLevel: "info",
      sinks: ["otel"],
    },
    {
      category: ["logtape", "meta"],
      lowestLevel: "warning",
      sinks: ["console"],
    },
  ],
  contextLocalStorage: new AsyncLocalStorage(),
});

/**
 * Middleware
 */
app.use("*", sentry({ dsn: process.env.SENTRY_DSN }));
app.use("*", requestId());
app.use("*", prettyJSON());

app.use("*", async (c, next) => {
  const reqId = c.get("requestId");
  const startTime = Date.now();

  await withContext(
    {
      request_id: reqId,
      method: c.req.method,
      url: c.req.url,
      user_agent: c.req.header("User-Agent"),
    },
    async () => {
      // Initialize wide event - one canonical log line per request
      const event: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        request_id: reqId,
        // Request context
        method: c.req.method,
        path: c.req.path,
        url: c.req.url,
        // Client context
        user_agent: c.req.header("User-Agent"),
        // Request metadata
        content_type: c.req.header("Content-Type"),
        // Environment characteristics
        service: "api-server",
        environment: env.NODE_ENV,
        region: env.FLY_REGION,
      };
      c.set("event", event);

      await next();

      // Performance
      const duration = Date.now() - startTime;
      event.duration_ms = duration;

      // Response context
      event.status_code = c.res.status;

      // Outcome
      if (c.error) {
        event.outcome = "error";
        event.error = {
          type: c.error.name,
          message: c.error.message,
          stack: c.error.stack,
        };
      } else {
        event.outcome = c.res.status < 400 ? "success" : "failure";
      }

      // Emit single canonical log line (sampled for otel, always for console in dev)
      if (shouldSample(event)) {
        otelLogger.info("request", { ...event });
      }

      // Console logging only for errors in production
      if (env.NODE_ENV !== "production" || c.res.status >= 500) {
        logger.info("request", {
          request_id: reqId,
          method: c.req.method,
          path: c.req.path,
          status_code: c.res.status,
          duration_ms: duration,
          outcome: event.outcome,
        });
      }
    },
  );
});

/**
 * Overload guards, after the wide event so shed requests still log with
 * `shed` / `rate_limited`, before any route so they stay cheap. Rate limits
 * go first so rejected traffic never occupies an in-flight slot.
 */
app.use("*", ...rateLimit);
app.use("*", concurrencyGuard.middleware);

app.onError(handleError);

/**
 * ConnectRPC Routes API v2 ftw
 */

mountRpcRoutes(app);

/**
 * OAuth 2.1 authorization server for MCP clients: RFC 8414 / 9728 metadata,
 * dynamic registration, authorize, token and revoke.
 */
app.route("/", createOAuthRoutes(oauthConfigFromEnv()));

/**
 * Public Routes
 */
app.route("/public", publicRoute);

/**
 * Ping Pong — liveness only, and deliberately so: this is the Fly HTTP check
 * and the container healthcheck, so it must not fail over a dependency
 * someone else operates. Dependency status lives on `/health`.
 */
app.get("/ping", (c) => {
  return c.json(
    { ping: "pong", region: env.FLY_REGION, requestId: c.get("requestId") },
    200,
  );
});

/**
 * Readiness — Turso, Upstash, Tinybird and Unkey, plus the vitals of the
 * machine that answered. Rate limited and shed like any other route.
 */
app.route(
  "/",
  createHealthRoute({
    probes: probesFromEnv(),
    inFlight: () => concurrencyGuard.inFlight(),
    maxInFlight: () => limits.maxInFlight,
  }),
);

app.route("/", openapiRoute);

app.get(
  "/openapi",
  Scalar({
    url: "/openapi.yaml",
    servers: [
      {
        url: "https://api.openstatus.dev/",
        description: "Production server",
      },
      {
        url: "http://localhost:3000/",
        description: "Dev server",
      },
    ],
    metaData: {
      title: "OpenStatus API",
      description: "Start building with OpenStatus API",
      ogDescription: "API Reference",
      ogTitle: "OpenStatus API",
      ogImage:
        "https://openstatus.dev/api/og?title=OpenStatus%20API&description=API%20Reference",
      twitterCard: "summary_large_image",
    },
  }),
);

/**
 * API Routes v1
 */
app.route("/v1", api);

/**
 * Slack Agent Routes
 */
app.route("/slack", slackRoute);

/**
 * MCP Server Routes
 *
 * Streamable HTTP transport — single endpoint authenticated by
 * `x-openstatus-key`. Per-request `McpServer` instance scoped to the
 * caller's workspace via closure capture. Tools wrap
 * `@openstatus/services` verbs; mutations write `metadata.transport:
 * "mcp"` to the audit log via the shared `emitAudit` plumbing.
 */
app.route("/mcp", mcpRoute);

/**
 * TODO: move to `workflows` app
 * This route is used by our checker to update the status of the monitors,
 * create incidents, and send notifications.
 */

if (env.NODE_ENV === "development") {
  showRoutes(app, { verbose: true, colorize: true });
}
