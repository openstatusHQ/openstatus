import { createRoute, z } from "@hono/zod-openapi";

import { and, asc, db, eq, inArray, isNotNull, isNull } from "@openstatus/db";
import {
  monitor,
  monitorsToStatusReport,
  page,
  pageSubscriber,
  pagesToStatusReports,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";

import type { statusReportsApi } from "./index";
import { StatusReportSchema } from "./schema";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { HTTPException } from "hono/http-exception";
import { isoDate } from "../utils";
import { sendEmailHtml } from "@openstatus/emails";

const postRoute = createRoute({
  method: "post",
  tags: ["status_report"],
  description: "Create a Status Report",
  path: "/",
  request: {
    body: {
      description: "The status report to create",
      content: {
        "application/json": {
          schema: StatusReportSchema.omit({
            id: true,
            statusReportUpdateIds: true,
          }).extend({
            date: isoDate.optional().openapi({
              description: "The date of the report in ISO8601 format",
            }),
            message: z.string().openapi({
              description: "The message of the current status of incident",
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: StatusReportSchema,
        },
      },
      description: "Status report created",
    },
    ...openApiErrorResponses,
  },
});

export function registerPostStatusReport(api: typeof statusReportsApi) {
  return api.openapi(postRoute, async (c) => {
    const input = c.req.valid("json");
    const workspaceId = c.get("workspaceId");
    const workspacePlan = c.get("workspacePlan");

    const { pageIds, monitorIds, date, ...rest } = input;

    if (monitorIds?.length) {
      const _monitors = await db
        .select()
        .from(monitor)
        .where(
          and(
            eq(monitor.workspaceId, Number(workspaceId)),
            inArray(monitor.id, monitorIds),
            isNull(monitor.deletedAt)
          )
        )
        .all();

      if (_monitors.length !== monitorIds.length) {
        throw new HTTPException(400, { message: "Monitor not found" });
      }
    }

    if (pageIds?.length) {
      const _pages = await db
        .select()
        .from(page)
        .where(
          and(
            eq(page.workspaceId, Number(workspaceId)),
            inArray(page.id, pageIds)
          )
        )
        .all();

      if (_pages.length !== pageIds.length) {
        throw new HTTPException(400, { message: "Page not found" });
      }
    }

    const _newStatusReport = await db
      .insert(statusReport)
      .values({
        ...rest,
        workspaceId: Number(workspaceId),
      })
      .returning()
      .get();

    const _newStatusReportUpdate = await db
      .insert(statusReportUpdate)
      .values({
        ...input,
        date: date ? new Date(date) : new Date(),
        statusReportId: _newStatusReport.id,
      })
      .returning()
      .get();

    if (pageIds?.length) {
      await db
        .insert(pagesToStatusReports)
        .values(
          pageIds.map((id) => {
            return {
              pageId: id,
              statusReportId: _newStatusReport.id,
            };
          })
        )
        .returning();
    }

    if (monitorIds?.length) {
      await db
        .insert(monitorsToStatusReport)
        .values(
          monitorIds.map((id) => {
            return {
              monitorId: id,
              statusReportId: _newStatusReport.id,
            };
          })
        )
        .returning();
    }

    if (workspacePlan.title !== "Hobby") {
      const allPages = await db
        .select()
        .from(pagesToStatusReports)
        .where(
          eq(pagesToStatusReports.statusReportId, Number(_newStatusReport.id))
        )
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
        await sendEmailHtml({
          to: subscribersEmails,
          subject: `New status update for ${pageInfo.title}`,
          html: `<p>Hi,</p><p>${pageInfo.title} just posted an update on their status page:</p><p>New Status : ${statusReportUpdate.status}</p><p>${statusReportUpdate.message}</p></p><p></p><p>Powered by OpenStatus</p><p></p><p></p><p></p><p></p><p></p>
        `,
          from: "Notification OpenStatus <notification@notifications.openstatus.dev>",
        });
      }
    }

    const data = StatusReportSchema.parse({
      ..._newStatusReport,
      monitorIds,
      pageIds,
      statusReportUpdateIds: [_newStatusReportUpdate.id],
    });

    return c.json(data);
  });
}
