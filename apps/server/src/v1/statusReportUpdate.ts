import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { and, db, eq, isNotNull } from "@openstatus/db";
import {
  page,
  pagesToStatusReports,
  pageSubscriber,
  statusReport,
  statusReportStatus,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import { sendEmailHtml } from "@openstatus/emails";
import { allPlans } from "@openstatus/plans";

import type { Variables } from ".";
import { ErrorSchema } from "./shared";
import { isoDate } from "./utils";

const statusReportUpdateApi = new OpenAPIHono<{ Variables: Variables }>();

const ParamsSelectSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the update",
      example: "1",
    }),
});

export const statusUpdateSchema = z.object({
  status: z.enum(statusReportStatus).openapi({
    description: "The status of the update",
  }),
  id: z.coerce.string().openapi({ description: "The id of the update" }),
  date: isoDate.openapi({
    description: "The date of the update in ISO8601 format",
  }),
  message: z.string().openapi({
    description: "The message of the update",
  }),
});

const createStatusReportUpdateSchema = z.object({
  status_report_id: z.number().openapi({
    description: "The id of the status report",
  }),
  status: z.enum(statusReportStatus).openapi({
    description: "The status of the update",
  }),
  date: isoDate.openapi({
    description: "The date of the update in ISO8601 format",
  }),
  message: z.string().openapi({
    description: "The message of the update",
  }),
});
const getUpdateRoute = createRoute({
  method: "get",
  tags: ["status_report_update"],
  path: "/:id",
  request: {
    params: ParamsSelectSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: statusUpdateSchema,
        },
      },
      description: "Get all status report updates",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});

statusReportUpdateApi.openapi(getUpdateRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const update = await db
    .select()
    .from(statusReportUpdate)
    .where(eq(statusReportUpdate.id, Number(id)))
    .get();

  if (!update) return c.json({ code: 404, message: "Not Found" }, 404);

  const currentStatusReport = await db
    .select()
    .from(statusReport)
    .where(
      and(
        eq(statusReport.id, update.statusReportId),
        eq(statusReport.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!currentStatusReport)
    return c.json({ code: 401, message: "Not Authorized" }, 401);

  const data = statusUpdateSchema.parse(update);

  return c.json(data);
});

const createStatusUpdate = createRoute({
  method: "post",
  tags: ["status_report_update"],
  path: "/",
  request: {
    body: {
      description: "the status report update",
      content: {
        "application/json": {
          schema: createStatusReportUpdateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: statusUpdateSchema,
        },
      },
      description: "Get all status report updates",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});

statusReportUpdateApi.openapi(createStatusUpdate, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const input = c.req.valid("json");

  const _currentStatusReport = await db
    .select()
    .from(statusReport)
    .where(
      and(
        eq(statusReport.id, input.status_report_id),
        eq(statusReport.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!_currentStatusReport)
    return c.json({ code: 401, message: "Not Authorized" }, 401);

  const res = await db
    .insert(statusReportUpdate)
    .values({
      ...input,
      date: new Date(input.date),
      statusReportId: input.status_report_id,
    })
    .returning()
    .get();
  // send email
  const workspacePlan = c.get("workspacePlan");

  if (workspacePlan !== allPlans.free) {
    const allPages = await db
      .select()
      .from(pagesToStatusReports)
      .where(eq(pagesToStatusReports.statusReportId, input.status_report_id))
      .all();
    for (const currentPage of allPages) {
      const subscribers = await db
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.pageId, currentPage.pageId),
            isNotNull(pageSubscriber.acceptedAt),
          ),
        )
        .all();
      const pageInfo = await db
        .select()
        .from(page)
        .where(eq(page.id, currentPage.pageId))
        .get();
      if (!pageInfo) continue;
      const subscribersEmails = subscribers.map(
        (subscriber) => subscriber.email,
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
  const data = statusUpdateSchema.parse(res);
  return c.json(data);
});

export { statusReportUpdateApi };
