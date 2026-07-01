import { createRoute } from "@hono/zod-openapi";
import { db } from "@openstatus/db";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { notEmpty } from "@/utils/not-empty";

import type { statusReportsApi } from "./index";
import { ParamsSchema, StatusReportSchema } from "./schema";

const getRoute = createRoute({
  method: "get",
  tags: ["status_report"],
  summary: "Get a status report",
  path: "/{id}",
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
        statusReportsToPageComponents: { with: { pageComponent: true } },
      },
      where: { workspaceId, id: Number(id) },
    });

    if (!_statusUpdate) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Status Report ${id} not found`,
      });
    }

    const { statusReportUpdates, statusReportsToPageComponents } =
      _statusUpdate;

    // most recent report information
    const { message, date } =
      statusReportUpdates[statusReportUpdates.length - 1];

    const data = StatusReportSchema.parse({
      ..._statusUpdate,
      message,
      date,
      monitorIds: statusReportsToPageComponents
        .map((sr) => sr.pageComponent.monitorId)
        .filter(notEmpty),

      statusReportUpdateIds: statusReportUpdates.map((update) => update.id),
    });

    return c.json(data, 200);
  });
}
