import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import type { RequestIdVariables } from "hono/request-id";

import { handleZodError } from "@/libs/errors";
import { authMiddleware } from "@/libs/middlewares";
import type { Workspace } from "@openstatus/db/src/schema";
import { checkApi } from "./check";
import { incidentsApi } from "./incidents";
import { maintenancesApi } from "./maintenances";
import { monitorsApi } from "./monitors";
import { notificationsApi } from "./notifications";
import { pageSubscribersApi } from "./pageSubscribers";
import { pagesApi } from "./pages";
import { statusReportUpdatesApi } from "./statusReportUpdates";
import { statusReportsApi } from "./statusReports";
import { whoamiApi } from "./whoami";

export type Variables = RequestIdVariables & {
  workspace: Workspace;
};

export const api = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

api.use("/openapi", cors());

api.openAPIRegistry.registerComponent("securitySchemes", "ApiKeyAuth", {
  type: "apiKey",
  in: "header",
  name: "x-openstatus-key",
  "x-openstatus-key": "string",
});

api.doc("/openapi", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "OpenStatus API",
    contact: {
      email: "ping@openstatus.dev",
      url: "https://www.openstatus.dev",
    },
    description:
      "OpenStatus is a open-source synthetic monitoring tool that allows you to monitor your website and API's uptime, latency, and more. \n\n The OpenStatus API allows you to interact with the OpenStatus platform programmatically. \n\n To get started you need to create an account on https://www.openstatus.dev/ and create an api token in your settings.",
  },
  tags: [
    {
      name: "monitor",
      description: "Monitor related endpoints",
      "x-displayName": "Monitor",
    },
    {
      name: "page",
      description: "Page related endpoints",
      "x-displayName": "Page",
    },
    {
      name: "status_report",
      description: "Status report related endpoints",
      "x-displayName": "Status Report",
    },
    {
      name: "status_report_update",
      description: "Status report update related endpoints",
      "x-displayName": "Status Report Update",
    },
    {
      name: "incident",
      description: "Incident related endpoints",
      "x-displayName": "Incident",
    },
    {
      name: "maintenance",
      description: "Maintenance related endpoints",
      "x-displayName": "Maintenance",
    },
    {
      name: "notification",
      description: "Notification related endpoints",
      "x-displayName": "Notification",
    },
    {
      name: "page_subscriber",
      description: "Page subscriber related endpoints",
      "x-displayName": "Page Subscriber",
    },
    {
      name: "check",
      description: "Check related endpoints",
      "x-displayName": "Check",
    },
    {
      name: "whoami",
      description: "WhoAmI related endpoints",
      "x-displayName": "WhoAmI",
    },
  ],
  security: [
    {
      ApiKeyAuth: [],
    },
  ],
});

api.get(
  "/",
  apiReference({
    spec: {
      url: "/v1/openapi",
    },
    baseServerURL: "https://api.openstatus.dev/v1",
    metaData: {
      title: "OpenStatus API",
      description: "API Reference",
      ogDescription: "API Reference",
      ogTitle: "OpenStatus API",
      ogImage:
        "https://openstatus.dev/api/og?title=OpenStatus%20API&description=API%20Reference",
      twitterCard: "summary_large_image",
    },
  }),
);
/**
 * Middlewares
 */
api.use("/*", authMiddleware);

/**
 * Routes
 */
api.route("/monitor", monitorsApi);
api.route("/page", pagesApi);
api.route("/status_report", statusReportsApi);
api.route("/status_report_update", statusReportUpdatesApi);
api.route("/incident", incidentsApi);
api.route("/maintenance", maintenancesApi);
api.route("/notification", notificationsApi);
api.route("/page_subscriber", pageSubscribersApi);
api.route("/check", checkApi);
api.route("/whoami", whoamiApi);
