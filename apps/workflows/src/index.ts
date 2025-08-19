import { sentry } from "@hono/sentry";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { logger } from "hono/logger";
import { checkerRoute } from "./checker";
import { cronRouter } from "./cron";
import { env } from "./env";

const { NODE_ENV, PORT } = env();

const app = new Hono({ strict: false }) // Add an onError hook to report unhandled exceptions to Sentry.
 .onError((err, c) => {
   // Report _all_ unhandled errors.
   c.get('sentry').captureException(err)
   return c.text('Internal Server Error', 500)
 });

app.use("*", sentry({ dsn: env().SENTRY_DSN }));

app.use("/*", logger());

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
