import { createRoute } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import { statusReport, statusReportUpdate } from "@openstatus/db/src/schema";

import { HTTPException } from "hono/http-exception";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import type { statusReportUpdatesApi } from "./index";
import { ParamsSchema, StatusReportUpdateSchema } from "./schema";

const getRoute = createRoute({
  method: "get",
  tags: ["status_report_update"],
  description: "Get a Status Reports Update",
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
    const workspaceId = c.get("workspaceId");
    const { id } = c.req.valid("param");

    const _statusReportJoin = await db
      .select()
      .from(statusReportUpdate)
      .innerJoin(
        statusReport,
        and(
          eq(statusReport.id, statusReportUpdate.statusReportId),
          eq(statusReport.workspaceId, Number(workspaceId)),
        ),
      )
      .where(eq(statusReportUpdate.id, Number(id)))
      .get();

    if (!_statusReportJoin) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const data = StatusReportUpdateSchema.parse(
      _statusReportJoin.status_report_update,
    );

    return c.json(data, 200);
  });
}
