import { createRoute } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import { statusReport, statusReportUpdate } from "@openstatus/db/src/schema";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { dispatchStatusReportUpdate } from "@openstatus/subscriptions";
import type { statusReportUpdatesApi } from "./index";
import { StatusReportUpdateSchema } from "./schema";

const createStatusUpdate = createRoute({
  method: "post",
  tags: ["status_report_update"],
  summary: "Create a status report update",
  path: "/",
  request: {
    body: {
      description: "The status report update to create",
      content: {
        "application/json": {
          schema: StatusReportUpdateSchema.omit({ id: true }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: StatusReportUpdateSchema,
        },
      },
      description: "The created status report update",
    },
    ...openApiErrorResponses,
  },
});

export function registerPostStatusReportUpdate(
  api: typeof statusReportUpdatesApi,
) {
  return api.openapi(createStatusUpdate, async (c) => {
    const workspaceId = c.get("workspace").id;
    const input = c.req.valid("json");
    const limits = c.get("workspace").limits;

    const _statusReport = await db.query.statusReport.findFirst({
      where: and(
        eq(statusReport.id, input.statusReportId),
        eq(statusReport.workspaceId, workspaceId),
      ),
      with: {
        statusReportsToPageComponents: {
          with: {
            pageComponent: true,
          },
        },
      },
    });

    if (!_statusReport) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Status Report ${input.statusReportId} not found`,
      });
    }

    const _statusReportUpdate = await db.transaction(async (tx) => {
      const update = await tx
        .insert(statusReportUpdate)
        .values({
          ...input,
          date: new Date(input.date),
          statusReportId: _statusReport.id,
        })
        .returning()
        .get();

      await tx
        .update(statusReport)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(statusReport.id, _statusReport.id));

      return update;
    });

    if (limits["status-subscribers"] && _statusReport.pageId) {
      await dispatchStatusReportUpdate(_statusReportUpdate.id);
    }

    const data = StatusReportUpdateSchema.parse(_statusReportUpdate);

    return c.json(data, 200);
  });
}
