import { OpenAPIHono } from "@hono/zod-openapi";
import { logger } from "hono/logger";

import type { Plan } from "@openstatus/plans";

import { middleware } from "./middleware";
import { monitorApi } from "./monitor";
import { statusReportApi } from "./statusReport";
import { statusReportUpdateApi } from "./statusReportUpdate";

export type Variables = {
  workspaceId: string;
  workspacePlan: Plan;
};

export const api = new OpenAPIHono<{ Variables: Variables }>();

api.doc("/openapi", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "OpenStatus API",
  },
});

/**
 * Authentification Middleware
 */
api.use("/*", middleware);
api.use("/*", logger());
api.route("/monitor", monitorApi);
api.route("/status_report_update", statusReportUpdateApi);

api.route("/status_report", statusReportApi);
