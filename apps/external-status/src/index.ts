import { AsyncLocalStorage } from "node:async_hooks";

import {
  configure,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
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
import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { requestId } from "hono/request-id";

import "./lib/sentry";
import { env } from "./env";
import { pingRoute } from "./health";

const { NODE_ENV, AXIOM_TOKEN, AXIOM_DATASET } = env();

// Static OTLP exporter import so tsdown bundles it: letting @logtape/otel
// create the exporter dynamic-imports a bare specifier the image can't resolve.
const loggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "openstatus-external-status",
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: NODE_ENV,
  }),
  processors: [
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: "https://eu-central-1.aws.edge.axiom.co/v1/logs",
        headers: {
          Authorization: `Bearer ${AXIOM_TOKEN}`,
          "X-Axiom-Dataset": AXIOM_DATASET,
        },
      }),
    ),
  ],
});

await configure({
  sinks: {
    console: getConsoleSink({ formatter: jsonLinesFormatter }),
    otel: getOpenTelemetrySink({ loggerProvider }),
  },
  loggers: [
    {
      category: "external-status",
      lowestLevel: "info",
      sinks: ["console", "otel"],
    },
  ],
  contextLocalStorage: new AsyncLocalStorage(),
});

const logger = getLogger(["external-status"]);

export const app = new Hono<{ Variables: { requestId: string } }>({
  strict: false,
});

app.use("*", requestId());

app.onError((err, c) => {
  logger.error("Unhandled request error", {
    error_name: err.name,
    error_message: err.message,
    error_stack: err.stack,
    method: c.req.method,
    path: c.req.path,
    request_id: c.get("requestId"),
  });
  Sentry.captureException(err);

  return c.json({ error: "Internal server error" }, 500);
});

app.get("/", (c) => c.text("external-status", 200));

app.route("/", pingRoute);

if (NODE_ENV === "development") {
  showRoutes(app, { verbose: true, colorize: true });
}
