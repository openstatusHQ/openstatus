import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, inArray, isNotNull, isNull } from "@openstatus/db";
import {
  monitor,
  monitorsToStatusReport,
  page,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { sendBatchEmailHtml } from "@openstatus/emails/src/send";
import type { statusReportsApi } from "./index";
import { StatusReportSchema } from "./schema";

const postRoute = createRoute({
  method: "post",
  tags: ["status_report"],
  summary: "Create a status report",
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
            date: z.coerce.date().optional().default(new Date()).openapi({
              description:
                "The date of the report in ISO8601 format, defaults to now",
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
      description: "The created status report",
    },
    ...openApiErrorResponses,
  },
});

export function registerPostStatusReport(api: typeof statusReportsApi) {
  return api.openapi(postRoute, async (c) => {
    const input = c.req.valid("json");
    const workspaceId = c.get("workspace").id;
    const limits = c.get("workspace").limits;

    if (input.monitorIds?.length) {
      const _monitors = await db
        .select()
        .from(monitor)
        .where(
          and(
            eq(monitor.workspaceId, workspaceId),
            inArray(monitor.id, input.monitorIds),
            isNull(monitor.deletedAt),
          ),
        )
        .all();

      if (_monitors.length !== input.monitorIds.length) {
        throw new OpenStatusApiError({
          code: "BAD_REQUEST",
          message: `Some of the monitors ${input.monitorIds.join(", ")} not found`,
        });
      }
    }

    const _pages = await db
      .select()
      .from(page)
      .where(and(eq(page.workspaceId, workspaceId), eq(page.id, input.pageId)))
      .all();

    if (_pages.length !== 1) {
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: `Page ${input.pageId} not found`,
      });
    }

    const _newStatusReport = await db
      .insert(statusReport)
      .values({
        status: input.status,
        title: input.title,
        pageId: input.pageId,
        workspaceId: workspaceId,
      })
      .returning()
      .get();

    const _newStatusReportUpdate = await db
      .insert(statusReportUpdate)
      .values({
        status: input.status,
        message: input.message,
        date: input.date,
        statusReportId: _newStatusReport.id,
      })
      .returning()
      .get();

    if (input.monitorIds?.length) {
      await db
        .insert(monitorsToStatusReport)
        .values(
          input.monitorIds.map((id) => {
            return {
              monitorId: id,
              statusReportId: _newStatusReport.id,
            };
          }),
        )
        .returning();
    }

    if (limits["status-subscribers"] && _newStatusReport.pageId) {
      const subscribers = await db
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.pageId, _newStatusReport.pageId),
            isNotNull(pageSubscriber.acceptedAt),
          ),
        )
        .all();

      const pageInfo = await db
        .select()
        .from(page)
        .where(eq(page.id, _newStatusReport.pageId))
        .get();

      if (pageInfo) {
        const emails = subscribers.map((subscriber) => {
          return {
            to: subscriber.email,
            subject: `New status update for ${pageInfo.title}`,
            html: `<p>Hi,</p><p>${pageInfo.title} just posted an update on their status page:</p><p>New Status : ${statusReportUpdate.status}</p><p>${statusReportUpdate.message}</p></p><p></p><p>Powered by OpenStatus</p><p></p><p></p><p></p><p></p><p></p>
          `,
            from: "Notification OpenStatus <notification@notifications.openstatus.dev>",
          };
        });

        await sendBatchEmailHtml(emails);
      }
    }

    const data = StatusReportSchema.parse({
      ..._newStatusReport,
      monitorIds: input.monitorIds,
      statusReportUpdateIds: [_newStatusReportUpdate.id],
    });

    return c.json(data, 200);
  });
}
