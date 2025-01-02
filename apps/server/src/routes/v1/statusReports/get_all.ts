import { createRoute, z } from "@hono/zod-openapi";

import { db, eq } from "@openstatus/db";
import { statusReport } from "@openstatus/db/src/schema";

import { openApiErrorResponses } from "@/libs/errors";
import type { statusReportsApi } from "./index";
import { StatusReportSchema } from "./schema";

const getAllRoute = createRoute({
  method: "get",
  tags: ["status_report"],
  summary: "List all status reports",
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
    const workspaceId = c.get("workspace").id;

    const _statusReports = await db.query.statusReport.findMany({
      with: {
        statusReportUpdates: true,
        monitorsToStatusReports: true,
      },
      where: eq(statusReport.workspaceId, workspaceId),
    });

    const data = z.array(StatusReportSchema).parse(
      _statusReports.map((r) => ({
        ...r,
        statusReportUpdateIds: r.statusReportUpdates.map((u) => u.id),
        monitorIds: r.monitorsToStatusReports.map((m) => m.monitorId),
      })),
    );

    return c.json(data, 200);
  });
}
