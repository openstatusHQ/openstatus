import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import { statusReport } from "@openstatus/db/src/schema";

import { HTTPException } from "hono/http-exception";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import type { statusReportsApi } from "./index";
import { ParamsSchema } from "./schema";

const deleteRoute = createRoute({
  method: "delete",
  tags: ["status_report"],
  description: "Delete a Status Report",
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
      throw new HTTPException(404, { message: "Not Found" });
    }

    await db
      .delete(statusReport)
      .where(eq(statusReport.id, Number(id)))
      .run();

    return c.json({}, 200);
  });
}
