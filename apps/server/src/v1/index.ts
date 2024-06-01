import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import type { Limits } from "@openstatus/plans/src/types";

import { incidentsApi } from "./incidents";
import { middleware } from "./middleware";
import { monitorsApi } from "./monitors";
import { notificationsApi } from "./notifications";
import { pagesApi } from "./pages";
import { statusReportsApi } from "./statusReports";
import { statusReportUpdateApi } from "./statusReportUpdate";
import { handleError } from "../libs/errors";

export type Variables = {
  workspaceId: string;
  workspacePlan: {
    title: "Hobby" | "Starter" | "Growth" | "Pro";
    description: string;
    price: number;
    limits: Limits;
  };
};

export const api = new OpenAPIHono<{ Variables: Variables }>();

api.onError(handleError);

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
api.route("/monitor", monitorsApi);
api.route("/notification", notificationsApi);
api.route("/page", pagesApi);
api.route("/status_report", statusReportsApi);
api.route("/status_report_update", statusReportUpdateApi);
