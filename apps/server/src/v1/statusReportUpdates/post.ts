import { createRoute } from "@hono/zod-openapi";

import { and, db, eq, isNotNull } from "@openstatus/db";
import {
  page,
  pageSubscriber,
  pagesToStatusReports,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import { sendEmailHtml } from "@openstatus/emails";

import type { statusReportUpdatesApi } from "./index";
import { StatusReportUpdateSchema } from "./schema";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { HTTPException } from "hono/http-exception";

const createStatusUpdate = createRoute({
  method: "post",
  tags: ["status_report_update"],
  path: "/",
  request: {
    body: {
      description: "the status report update",
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
      description: "Get all status report updates",
    },
    ...openApiErrorResponses,
  },
});

export function registerPostStatusReportUpdate(
  api: typeof statusReportUpdatesApi
) {
  return api.openapi(createStatusUpdate, async (c) => {
    const workspaceId = c.get("workspaceId");
    const workspacePlan = c.get("workspacePlan");
    const input = c.req.valid("json");

    const _statusReport = await db
      .select()
      .from(statusReport)
      .where(
        and(
          eq(statusReport.id, input.statusReportId),
          eq(statusReport.workspaceId, Number(workspaceId))
        )
      )
      .get();

    if (!_statusReport) {
      throw new HTTPException(404, {
        message:
          "Not Found - Status report id does not exist within your workspace",
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

    // send email

    if (workspacePlan.title !== "Hobby") {
      const allPages = await db
        .select()
        .from(pagesToStatusReports)
        .where(eq(pagesToStatusReports.statusReportId, _statusReport.id))
        .all();

      for (const currentPage of allPages) {
        const subscribers = await db
          .select()
          .from(pageSubscriber)
          .where(
            and(
              eq(pageSubscriber.pageId, currentPage.pageId),
              isNotNull(pageSubscriber.acceptedAt)
            )
          )
          .all();

        const pageInfo = await db
          .select()
          .from(page)
          .where(eq(page.id, currentPage.pageId))
          .get();
        if (!pageInfo) continue;
        const subscribersEmails = subscribers.map(
          (subscriber) => subscriber.email
        );

        // TODO: verify if we leak any email data here
        await sendEmailHtml({
          to: subscribersEmails,
          subject: `New status update for ${pageInfo.title}`,
          html: `<p>Hi,</p><p>${pageInfo.title} just posted an update on their status page:</p><p>New Status : ${statusReportUpdate.status}</p><p>${statusReportUpdate.message}</p></p><p></p><p>Powered by OpenStatus</p><p></p><p></p><p></p><p></p><p></p>
          `,
          from: "Notification OpenStatus <notification@notifications.openstatus.dev>",
        });
      }
    }

    const data = StatusReportUpdateSchema.parse(_statusReportUpdate);

    return c.json(data);
  });
}
