import { createRoute, z } from "@hono/zod-openapi";

import { and, asc, db, eq, inArray, isNotNull, isNull } from "@openstatus/db";
import {
  monitor,
  monitorsToStatusReport,
  page,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";

import { sendEmailHtml } from "@openstatus/emails";
import { HTTPException } from "hono/http-exception";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { isoDate } from "../utils";
import type { statusReportsApi } from "./index";
import { StatusReportSchema } from "./schema";

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

    const { monitorIds, date, ...rest } = input;

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


    if(rest.pageId){
      const _pages = await db
      .select()
      .from(page)
      .where(
        and(
          eq(page.workspaceId, Number(workspaceId)),
          eq(page.id, rest.pageId)
        )
      )
      .all();

    if (_pages.length !== 1) {
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

    if (workspacePlan.limits.notifications && _newStatusReport.pageId) {
      const subscribers = await db
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.pageId, _newStatusReport.pageId),
            isNotNull(pageSubscriber.acceptedAt)
          )
        )
        .all();
      const pageInfo = await db
        .select()
        .from(page)
        .where(eq(page.id, _newStatusReport.pageId))
        .get();
      if (pageInfo) {
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
      statusReportUpdateIds: [_newStatusReportUpdate.id],
    });

    return c.json(data, 200);
  });
}
