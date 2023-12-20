import { sentry } from "@hono/sentry";
import { Hono } from "hono";
import { logger } from "hono/logger";

import { checkerRoute } from "./checker";
import { env } from "./env";
import { publicRoute } from "./public";
import { api } from "./v1";

const app = new Hono({ strict: false });
app.use("*", sentry({ dsn: process.env.SENTRY_DSN }));

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
if (process.env.NODE_ENV === "development") {
  app.showRoutes();
}

console.log("Starting server on port 3000");

export default app;
