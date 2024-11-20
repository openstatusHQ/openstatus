import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import { handleError, handleZodError } from "../libs/errors";
import { checkAPI } from "./check";
import { incidentsApi } from "./incidents";
import { middleware } from "./middleware";
import { monitorsApi } from "./monitors";
import { notificationsApi } from "./notifications";
import { pageSubscribersApi } from "./pageSubscribers";
import { pagesApi } from "./pages";
import { statusReportUpdatesApi } from "./statusReportUpdates";
import { statusReportsApi } from "./statusReports";
import { whoamiApi } from "./whoami";

export type Variables = {
  workspaceId: string;
  workspacePlan: {
    title: "Hobby" | "Starter" | "Growth" | "Pro";
    description: string;
    price: number;
  };
  limits: Limits;
};

export const api = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

api.onError(handleError);

api.use("/openapi", cors());

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
      "OpenStatus is a open-source synthetic monitoring tool that allows you to monitor your website and API's uptime, latency, and more. \n\n The OpenStatus API allows you to interact with the OpenStatus platform programmatically. ",
  },
});

api.get(
  "/",
  apiReference({
    spec: {
      url: "/v1/openapi",
    },
    baseServerURL: "https://api.openstatus.dev/v1",
  }),
);
/**
 * Authentification Middleware
 */
api.use("/*", middleware);
api.use("/*", logger());

/**
 * Routes
 */
api.route("/incident", incidentsApi);
api.route("/monitor", monitorsApi);
api.route("/notification", notificationsApi);
api.route("/page", pagesApi);
api.route("/page_subscriber", pageSubscribersApi);
api.route("/status_report", statusReportsApi);
api.route("/status_report_update", statusReportUpdatesApi);
api.route("/check", checkAPI);

api.route("/whoami", whoamiApi);
