import { createRoute } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import { statusReport, statusReportUpdate } from "@openstatus/db/src/schema";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import type { statusReportUpdatesApi } from "./index";
import { ParamsSchema, StatusReportUpdateSchema } from "./schema";

const getRoute = createRoute({
  method: "get",
  tags: ["status_report_update"],
  summary: "Get a status report update",
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: StatusReportUpdateSchema,
        },
      },
      description: "Get a status report update",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetStatusReportUpdate(
  api: typeof statusReportUpdatesApi,
) {
  return api.openapi(getRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const { id } = c.req.valid("param");

    const _statusReport = await db
      .select()
      .from(statusReportUpdate)
      .innerJoin(
        statusReport,
        and(
          eq(statusReport.id, statusReportUpdate.statusReportId),
          eq(statusReport.workspaceId, workspaceId),
        ),
      )
      .where(eq(statusReportUpdate.id, Number(id)))
      .get();

    if (!_statusReport) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Status Report Update ${id} not found`,
      });
    }

    const data = StatusReportUpdateSchema.parse(
      _statusReport.status_report_update,
    );

    return c.json(data, 200);
  });
}
