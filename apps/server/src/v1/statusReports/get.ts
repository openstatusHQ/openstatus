import { createRoute } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import { statusReport } from "@openstatus/db/src/schema";

import type { statusReportsApi } from "./index";
import { ParamsSchema, StatusReportSchema } from "./schema";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { HTTPException } from "hono/http-exception";

const getRoute = createRoute({
  method: "get",
  tags: ["status_report"],
  description: "Get an status report",
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: StatusReportSchema,
        },
      },
      description: "Get all status reports",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetStatusReport(api: typeof statusReportsApi) {
  return api.openapi(getRoute, async (c) => {
    const workspaceId = c.get("workspaceId");
    const { id } = c.req.valid("param");

    const _statusReport = await db.query.statusReport.findFirst({
      with: {
        statusReportUpdates: true,
      },
      where: and(
        eq(statusReport.workspaceId, Number(workspaceId)),
        eq(statusReport.id, Number(id)),
      ),
    });

    if (!_statusReport) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const data = StatusReportSchema.parse({
      ..._statusReport,
      status_report_updates: _statusReport.statusReportUpdates.map(
        (update) => update.id,
      ),
    });

    return c.json(data);
  });
}
