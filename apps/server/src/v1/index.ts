import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { page } from "@openstatus/db/src/schema";
import type { Limits } from "@openstatus/plans/src/types";

import { incidentsApi } from "./incidents";
import { middleware } from "./middleware";
import { monitorApi } from "./monitor";
import { notificationApi } from "./notification";
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

api.use("/openapi", cors());

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
api.route("/incident", incidentsApi);
api.route("/monitor", monitorApi);
api.route("/notification", notificationApi);
api.route("/page", pageApi);

api.route("/status_report", statusReportApi);
api.route("/status_report_update", statusReportUpdateApi);
