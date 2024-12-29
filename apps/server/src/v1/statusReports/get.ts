import { createRoute } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import { statusReport } from "@openstatus/db/src/schema";

import { HTTPException } from "hono/http-exception";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import type { statusReportsApi } from "./index";
import { ParamsSchema, StatusReportSchema } from "./schema";

const getRoute = createRoute({
  method: "get",
  tags: ["status_report"],
  description: "Get a Status Report",
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

export function regsiterGetStatusReport(api: typeof statusReportsApi) {
  return api.openapi(getRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const { id } = c.req.valid("param");

    const _statusUpdate = await db.query.statusReport.findFirst({
      with: {
        statusReportUpdates: true,
        monitorsToStatusReports: true,
      },
      where: and(
        eq(statusReport.workspaceId, workspaceId),
        eq(statusReport.id, Number(id)),
      ),
    });

    if (!_statusUpdate) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const { statusReportUpdates, monitorsToStatusReports } = _statusUpdate;

    // most recent report information
    const { message, date } =
      statusReportUpdates[statusReportUpdates.length - 1];

    const data = StatusReportSchema.parse({
      ..._statusUpdate,
      message,
      date,
      monitorIds: monitorsToStatusReports.length
        ? monitorsToStatusReports.map((monitor) => monitor.monitorId)
        : null,

      statusReportUpdateIds: statusReportUpdates.map((update) => update.id),
    });

    return c.json(data, 200);
  });
}
