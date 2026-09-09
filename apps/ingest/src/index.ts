import { getLogger } from "@logtape/logtape";
import { Hono } from "hono";
import { requestId } from "hono/request-id";

import { redactKey } from "./lib/auth";
import { cronRoute } from "./routes/cron";
import { healthRoute } from "./routes/health";
import { ingestRoute } from "./routes/ingest";

export const app = new Hono({ strict: false });

const logger = getLogger(["ingest"]);

app.use("*", requestId());

app.use("*", async (c, next) => {
  const started = Date.now();
  await next();
  logger.info("request", {
    request_id: c.get("requestId"),
    method: c.req.method,
    // The `?key=` fallback puts a credential in the URL; it must never be logged.
    url: redactKey(c.req.url),
    status_code: c.res.status,
    duration_ms: Date.now() - started,
  });
});

app.route("/", healthRoute);
app.route("/v1/ingest", ingestRoute);
app.route("/cron", cronRoute);

app.onError((error, c) => {
  logger.error("unhandled", {
    request_id: c.get("requestId"),
    error: error.message,
  });
  return c.json({ error: "internal error" }, 500);
});
