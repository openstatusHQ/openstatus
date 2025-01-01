import { createRoute } from "@hono/zod-openapi";

import { and, db, eq, isNotNull } from "@openstatus/db";
import {
  page,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import { sendEmailHtml } from "@openstatus/emails";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
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

    const _statusReport = await db
      .select()
      .from(statusReport)
      .where(
        and(
          eq(statusReport.id, input.statusReportId),
          eq(statusReport.workspaceId, workspaceId),
        ),
      )
      .get();

    if (!_statusReport) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Status Report ${input.statusReportId} not found`,
      });
    }

    const _statusReportUpdate = await db
      .insert(statusReportUpdate)
      .values({
        ...input,
        date: new Date(input.date),
        statusReportId: _statusReport.id,
      })
      .returning()
      .get();

    if (limits["status-subscribers"] && _statusReport.pageId) {
      const subscribers = await db
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.pageId, _statusReport.pageId),
            isNotNull(pageSubscriber.acceptedAt),
          ),
        )
        .all();

      const pageInfo = await db
        .select()
        .from(page)
        .where(eq(page.id, _statusReport.pageId))
        .get();
      if (pageInfo) {
        const subscribersEmails = subscribers.map((subscriber) => ({
          to: subscriber.email,
          subject: `New status update for ${pageInfo.title}`,
          html: `<p>Hi,</p><p>${pageInfo.title} just posted an update on their status page:</p><p>New Status : ${statusReportUpdate.status}</p><p>${statusReportUpdate.message}</p></p><p></p><p>Powered by OpenStatus</p><p></p><p></p><p></p><p></p><p></p>
            `,
          from: "Notification OpenStatus <notification@notifications.openstatus.dev>",
        }));

        await sendEmailHtml(subscribersEmails);
      }
    }

    const data = StatusReportUpdateSchema.parse(_statusReportUpdate);

    return c.json(data, 200);
  });
}
