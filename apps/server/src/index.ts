import { AsyncLocalStorage } from "node:async_hooks";

import { sentry } from "@hono/sentry";
import {
  configureSync,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
  withContext,
} from "@logtape/logtape";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";

import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";
import { env } from "./env";
import { handleError } from "./libs/errors";
import { publicRoute } from "./routes/public";
import { api } from "./routes/v1";
import { mountRpcRoutes } from "./routes/v2";

configureSync({
  sinks: {
    console: getConsoleSink({ formatter: jsonLinesFormatter }),
  },
  loggers: [
    {
      category: "api-server",
      lowestLevel: "debug",
      sinks: ["console"],
    },
  ],
  contextLocalStorage: new AsyncLocalStorage(),
});

const logger = getLogger("api-server");

export const app = new Hono({ strict: false });

/**
 * Middleware
 */
app.use("*", sentry({ dsn: process.env.SENTRY_DSN }));
app.use("*", requestId());
// app.use("*", logger());
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

app.onError(handleError);

/**
 * ConnectRPC Routes API v2
 */
mountRpcRoutes(app);

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
