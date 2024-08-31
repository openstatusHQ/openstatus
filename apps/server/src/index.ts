import { sentry } from "@hono/sentry";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { logger } from "hono/logger";

import { checkerRoute } from "./checker";
import { env } from "./env";
import { handleError } from "./libs/errors";
import { publicRoute } from "./public";
import { api } from "./v1";

const app = new Hono({ strict: false });
app.use("*", sentry({ dsn: process.env.SENTRY_DSN }));
app.onError(handleError);

/**
 * Public Routes
 */
app.route("/public", publicRoute);

/**
 * Ping Pong
 */
app.use("/ping", logger());
app.get("/ping", (c) => c.json({ ping: "pong", region: env.FLY_REGION }, 200));

/**
 * API Routes v1
 */
app.route("/v1", api);

app.route("/", checkerRoute);

const isDev = process.env.NODE_ENV === "development";
const port = 3000;

if (isDev) showRoutes(app, { verbose: true, colorize: true });

console.log(`Starting server on port ${port}`);

const server = { port, fetch: app.fetch };

export default server;
