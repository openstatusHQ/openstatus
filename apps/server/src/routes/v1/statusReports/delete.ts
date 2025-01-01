import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import { statusReport } from "@openstatus/db/src/schema";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import type { statusReportsApi } from "./index";
import { ParamsSchema } from "./schema";

const deleteRoute = createRoute({
  method: "delete",
  tags: ["status_report"],
  summary: "Delete a status report",
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({}),
        },
      },
      description: "Status report deleted",
    },
    ...openApiErrorResponses,
  },
});

export function registerDeleteStatusReport(api: typeof statusReportsApi) {
  return api.openapi(deleteRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const { id } = c.req.valid("param");

    const _statusReport = await db
      .select()
      .from(statusReport)
      .where(
        and(
          eq(statusReport.id, Number(id)),
          eq(statusReport.workspaceId, workspaceId),
        ),
      )
      .get();

    if (!_statusReport) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Status Report ${id} not found`,
      });
    }

    await db
      .delete(statusReport)
      .where(eq(statusReport.id, Number(id)))
      .run();

    return c.json({}, 200);
  });
}
