import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, isNotNull } from "@openstatus/db";
import {
  page,
  pageSubscriber,
  pagesToStatusReports,
  statusReport,
  statusReportStatus,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import { sendEmailHtml } from "@openstatus/emails/emails/send";
import { allPlans } from "@openstatus/plans";

import type { Variables } from "./index";
import { ErrorSchema } from "./shared";
import { statusUpdateSchema } from "./statusReportUpdate";
import { isoDate } from "./utils";

const statusReportApi = new OpenAPIHono<{ Variables: Variables }>();

const ParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the status report",
      example: "1",
    }),
});

const createStatusReportUpdateSchema = z.object({
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

const statusSchema = z.object({
  title: z.string().openapi({
    example: "Documenso",
    description: "The title of the status report",
  }),
  status: z.enum(statusReportStatus).openapi({
    description: "The current status of the report",
  }),
});

const statusReportExtendedSchema = statusSchema.extend({
  id: z.number().openapi({ description: "The id of the status report" }),
  status_report_updates: z
    .array(z.number())
    .openapi({
      description: "The ids of the status report updates",
    })
    .default([]),
});

const getAllRoute = createRoute({
  method: "get",
  tags: ["status_report"],
  description: "Get all status reports",
  path: "/",
  request: {},
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(statusReportExtendedSchema),
        },
      },
      description: "Get all status reports",
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

statusReportApi.openapi(getAllRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const _statusReports = await db.query.statusReport.findMany({
    with: {
      statusReportUpdates: true,
    },
    where: eq(statusReport.workspaceId, workspaceId),
  });

  if (!_statusReports) return c.json({ code: 404, message: "Not Found" }, 404);

  const data = z.array(statusReportExtendedSchema).parse(
    _statusReports.map((statusReport) => ({
      ...statusReport,
      status_report_updates: statusReport.statusReportUpdates.map(
        (statusReportUpdate) => {
          return statusReportUpdate.id;
        },
      ),
    })),
  );

  return c.json(data);
});

const getRoute = createRoute({
  method: "get",
  tags: ["status_report"],
  description: "Get an status report",
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: statusReportExtendedSchema,
        },
      },
      description: "Get all status reports",
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

statusReportApi.openapi(getRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const statusUpdateId = Number(id);
  const _statusUpdate = await db.query.statusReport.findFirst({
    with: {
      statusReportUpdates: true,
    },
    where: and(
      eq(statusReport.workspaceId, workspaceId),
      eq(statusReport.id, statusUpdateId),
    ),
  });

  if (!_statusUpdate) return c.json({ code: 404, message: "Not Found" }, 404);
  const data = statusReportExtendedSchema.parse({
    ..._statusUpdate,
    status_report_updates: _statusUpdate.statusReportUpdates.map(
      (update) => update.id,
    ),
  });

  return c.json(data);
});

const postRoute = createRoute({
  method: "post",
  tags: ["status_report"],
  description: "Create an status report",
  path: "/",
  request: {
    body: {
      description: "The status report to create",
      content: {
        "application/json": {
          schema: statusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: statusReportExtendedSchema,
        },
      },
      description: "Status report created",
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

statusReportApi.openapi(postRoute, async (c) => {
  const input = c.req.valid("json");
  const workspaceId = Number(c.get("workspaceId"));

  const _newStatusReport = await db
    .insert(statusReport)
    .values({
      ...input,
      workspaceId: workspaceId,
    })
    .returning()
    .get();

  const data = statusReportExtendedSchema.parse(_newStatusReport);

  return c.json(data);
});

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
          schema: z.object({
            message: z.string().openapi({
              example: "Deleted",
            }),
          }),
        },
      },
      description: "Status report deleted",
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

statusReportApi.openapi(deleteRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const statusReportId = Number(id);
  const _statusReport = await db
    .select()
    .from(statusReport)
    .where(eq(statusReport.id, statusReportId))
    .get();

  if (!_statusReport) return c.json({ code: 404, message: "Not Found" }, 404);

  if (workspaceId !== _statusReport.workspaceId)
    return c.json({ code: 401, message: "Unauthorized" }, 401);

  await db
    .delete(statusReport)
    .where(eq(statusReport.id, statusReportId))
    .run();
  return c.json({ message: "Deleted" });
});

const postRouteUpdate = createRoute({
  method: "post",
  tags: ["status_report"],
  path: "/:id/update",
  description: "Create an status report update",
  request: {
    params: ParamsSchema,
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
      description: "Status report updated",
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

statusReportApi.openapi(postRouteUpdate, async (c) => {
  const input = c.req.valid("json");
  const { id } = c.req.valid("param");
  const workspaceId = Number(c.get("workspaceId"));

  const statusReportId = Number(id);
  const _statusReport = await db
    .select()
    .from(statusReport)
    .where(
      and(
        eq(statusReport.id, statusReportId),
        eq(statusReport.workspaceId, workspaceId),
      ),
    )
    .get();

  if (!_statusReport) return c.json({ code: 404, message: "Not Found" }, 404);

  const _statusReportUpdate = await db
    .insert(statusReportUpdate)
    .values({
      ...input,
      date: new Date(input.date),
      statusReportId: Number(id),
    })
    .returning()
    .get();
  // send email
  const workspacePlan = c.get("workspacePlan");
  if (workspacePlan !== allPlans.free) {
    const allPages = await db
      .select()
      .from(pagesToStatusReports)
      .where(eq(pagesToStatusReports.statusReportId, statusReportId))
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
        from: "Notification OpenStatus <notification@openstatus.dev>",
      });
    }
  }
  const data = statusUpdateSchema.parse(_statusReportUpdate);

  return c.json({
    ...data,
  });
});

export { statusReportApi };
