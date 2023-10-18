import { Hono } from "hono";

import { env } from "./env";
import { publicRoute } from "./public";
import { api } from "./v1";
import { VercelIngest } from "./vercel";
import { checkerRoute } from "./checker";

const app = new Hono();

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
app.get("/ping", (c) => c.json({ ping: "pong", region: env.FLY_REGION }));

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
