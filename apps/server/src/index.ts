import { sentry } from "@hono/sentry";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { logger } from "hono/logger";

import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";
import { env } from "./env";
import { handleError } from "./libs/errors";
import { checkerRoute } from "./routes/checker";
import { publicRoute } from "./routes/public";
import { api } from "./routes/v1";

export const app = new Hono({ strict: false });

/**
 * Middleware
 */
app.use("*", sentry({ dsn: process.env.SENTRY_DSN }));
app.use("*", requestId());
app.use("*", logger());
app.use("*", prettyJSON());

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
app.route("/", checkerRoute);

const isDev = process.env.NODE_ENV === "development";
const port = 3000;

if (isDev) showRoutes(app, { verbose: true, colorize: true });

console.log(`Starting server on port ${port}`);

const server = { port, fetch: app.fetch };

export default server;
