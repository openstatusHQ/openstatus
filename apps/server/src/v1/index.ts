import { OpenAPIHono } from "@hono/zod-openapi";

import type { Plan } from "@openstatus/plans";

import { incidentApi } from "./incident";
import { middleware } from "./middleware";
import { monitorApi } from "./monitor";

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

api.route("/monitor", monitorApi);
api.route("/incident", incidentApi);
