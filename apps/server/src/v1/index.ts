import { OpenAPIHono } from "@hono/zod-openapi";
import { logger } from "hono/logger";

import { page } from "@openstatus/db/src/schema";
import type { Limits } from "@openstatus/plans/src/types";

import { incidentsApi } from "./incidents";
import { middleware } from "./middleware";
import { monitorApi } from "./monitor";
import { pageApi } from "./page";
import { statusReportApi } from "./statusReport";
import { statusReportUpdateApi } from "./statusReportUpdate";

export type Variables = {
  workspaceId: string;
  workspacePlan: {
    title: string;
    description: string;
    price: number;
    limits: Limits;
  };
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
api.route("/incident", incidentsApi);
api.route("/page", pageApi);

api.route("/status_report", statusReportApi);
