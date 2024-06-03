import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import { statusReport } from "@openstatus/db/src/schema";

import type { statusReportsApi } from "./index";
import { ParamsSchema } from "./schema";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { HTTPException } from "hono/http-exception";

const deleteRoute = createRoute({
  method: "delete",
  tags: ["status_report"],
  description: "Delete an status report",
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
    const workspaceId = c.get("workspaceId");
    const { id } = c.req.valid("param");

    const _statusReport = await db
      .select()
      .from(statusReport)
      .where(
        and(
          eq(statusReport.id, Number(id)),
          eq(statusReport.workspaceId, Number(workspaceId))
        )
      )
      .get();

    if (!_statusReport) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    await db
      .delete(statusReport)
      .where(eq(statusReport.id, Number(id)))
      .run();

    return c.json({});
  });
}
