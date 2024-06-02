import { createRoute, z } from "@hono/zod-openapi";

import { db, eq } from "@openstatus/db";
import { statusReport } from "@openstatus/db/src/schema";

import type { statusReportsApi } from "./index";
import { StatusReportSchema } from "./schema";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { HTTPException } from "hono/http-exception";

const getAllRoute = createRoute({
  method: "get",
  tags: ["status_report"],
  description: "Get all status reports",
  path: "/",
  request: {},
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(StatusReportSchema),
        },
      },
      description: "Get all status reports",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetAllStatusReports(api: typeof statusReportsApi) {
  return api.openapi(getAllRoute, async (c) => {
    const workspaceId = c.get("workspaceId");

    await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.workspaceId, Number(workspaceId)))
      .all();

    const _statusReports = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.workspaceId, Number(workspaceId)))
      .all();

    if (!_statusReports) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const data = z.array(StatusReportSchema).parse(
      _statusReports.map((r) => ({
        ...r,
        // FIXME: add missing fields
        statusReportUpdateIds: [],
        pageIds: [],
        monitorIds: [],
      }))
    );

    return c.json(data);
  });
}
