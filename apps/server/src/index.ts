import { Hono } from "hono";

import { checkerRoute } from "./checker";
import { env } from "./env";
import { publicRoute } from "./public";
import { api } from "./v1";
import { VercelIngest } from "./vercel";
import { sentry } from "@hono/sentry";

const app = new Hono();
app.use("*", sentry({ dsn: process.env.SENTRY_DSN }));

/**
 * Vercel Integration
 */
app.post("/integration/vercel", VercelIngest);

/**
 * Public Routes
 */
app.route("/public", publicRoute);

/**
 * Ping Pong
 */
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
