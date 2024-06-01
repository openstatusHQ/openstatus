import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { and, asc, db, eq, isNotNull } from "@openstatus/db";
import {
  monitorsToStatusReport,
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

const reportSchema = z.object({
  id: z.number().openapi({ description: "The id of the status report" }),
  title: z.string().openapi({
    example: "Documenso",
    description: "The title of the status report",
  }),
  status: z.enum(statusReportStatus).openapi({
    description: "The current status of the report",
  }),
  date: isoDate.openapi({
    description: "The date of the report in ISO8601 format",
  }),
  status_report_updates: z.array(z.number()).openapi({
    description: "The ids of the status report updates",
  }),
  message: z.string().openapi({
    description: "The message of the current status of incident",
  }),
  monitors_id: z
    .array(z.number())
    .openapi({
      description: "id of monitors this report needs to refer",
    })
    .nullable(),
  pages_id: z
    .array(z.number())
    .openapi({
      description: "id of status pages this report needs to refer",
    })
    .nullable(),
});

const createStatusReportSchema = z.object({
  title: z.string().openapi({
    example: "Documenso",
    description: "The title of the status report",
  }),
  status: z.enum(statusReportStatus).openapi({
    description: "The current status of the report",
  }),
  message: z.string().openapi({
    description: "The message of the current status of incident",
  }),
  date: isoDate
    .openapi({
      description: "The date of the report in ISO8601 format",
    })
    .optional(),
  monitors_id: z
    .array(z.number())
    .openapi({
      description: "id of monitors this report needs to refer",
    })
    .optional()
    .default([]),
  pages_id: z
    .array(z.number())
    .openapi({
      description: "id of status pages this report needs to refer",
    })
    .optional()
    .default([]),
});

const updateStatusReportSchema = z.object({
  title: z
    .string()
    .openapi({
      example: "Documenso",
      description: "The title of the status report to update",
    })
    .optional(),
  status: z
    .enum(statusReportStatus)
    .openapi({
      description: "The status of the report to update",
    })
    .optional(),
  message: z
    .string()
    .openapi({
      description: "The message of the status of incident to update",
    })
    .optional(),
  date: isoDate
    .openapi({
      description: "The date of the report in ISO8601 format to update",
    })
    .optional(),
  monitors_id: z
    .array(z.number())
    .openapi({
      description: "id of monitors this report needs to refer when update",
    })
    .optional(),
  pages_id: z
    .array(z.number())
    .openapi({
      description: "id of status pages this report needs to refer when update",
    })
    .optional(),
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
          schema: z.array(reportSchema),
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
      monitorsToStatusReports: true,
      pagesToStatusReports: true,
    },
    where: eq(statusReport.workspaceId, workspaceId),
  });

  if (!_statusReports) return c.json({ code: 404, message: "Not Found" }, 404);

  const data = z.array(reportSchema).parse(
    _statusReports.map((statusReport) => {
      const {
        statusReportUpdates,
        monitorsToStatusReports,
        pagesToStatusReports,
      } = statusReport;
      const { message, date } =
        statusReportUpdates[statusReportUpdates.length - 1];
      return {
        ...statusReport,
        message,
        date,
        monitors_id: monitorsToStatusReports.length
          ? monitorsToStatusReports.map((monitor) => monitor.monitorId)
          : null,
        pages_id: pagesToStatusReports.length
          ? pagesToStatusReports.map((page) => page.pageId)
          : null,
        status_report_updates: statusReportUpdates.map((update) => update.id),
      };
    }),
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
          schema: reportSchema,
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
      monitorsToStatusReports: true,
      pagesToStatusReports: true,
    },
    where: and(
      eq(statusReport.workspaceId, workspaceId),
      eq(statusReport.id, statusUpdateId),
    ),
  });

  if (!_statusUpdate) return c.json({ code: 404, message: "Not Found" }, 404);
  const { statusReportUpdates, monitorsToStatusReports, pagesToStatusReports } =
    _statusUpdate;

  // most recent report information
  const { message, date } = statusReportUpdates[statusReportUpdates.length - 1];

  const data = reportSchema.parse({
    ..._statusUpdate,
    message,
    date,
    monitors_id: monitorsToStatusReports.length
      ? monitorsToStatusReports.map((monitor) => monitor.monitorId)
      : null,
    pages_id: pagesToStatusReports.length
      ? pagesToStatusReports.map((page) => page.pageId)
      : null,
    status_report_updates: statusReportUpdates.map((update) => update.id),
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
          schema: createStatusReportSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: reportSchema,
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

  const { pages_id, monitors_id, date } = input;

  if (monitors_id.length) {
    const monitors = (
      await db.query.monitor.findMany({
        columns: {
          id: true,
        },
      })
    ).map((m) => m.id);

    const nonExistingId = monitors_id.filter((m) => !monitors.includes(m));

    if (nonExistingId.length) {
      return c.json(
        {
          code: 400,
          message: `monitor(s) with id [${nonExistingId}] doesn't exist `,
        },
        400,
      );
    }
  }

  // pages check

  if (pages_id.length) {
    const pages = (
      await db.query.page.findMany({
        columns: {
          id: true,
        },
      })
    ).map((m) => m.id);

    const nonExistingId = pages_id.filter((m) => !pages.includes(m));

    if (nonExistingId.length) {
      return c.json(
        {
          code: 400,
          message: `page(s) with id [${nonExistingId}] doesn't exist `,
        },
        400,
      );
    }
  }

  const _newStatusReport = await db
    .insert(statusReport)
    .values({
      ...input,
      workspaceId: workspaceId,
    })
    .returning()
    .get();

  const _statusReportHistory = await db
    .insert(statusReportUpdate)
    .values({
      ...input,
      date: date ? new Date(date) : new Date(),
      statusReportId: _newStatusReport.id,
    })
    .returning()
    .get();

  const pageToStatusIds: number[] = [];
  const monitorToStatusIds: number[] = [];

  if (pages_id.length) {
    pageToStatusIds.push(
      ...(
        await db
          .insert(pagesToStatusReports)
          .values(
            pages_id.map((id) => {
              return {
                pageId: id,
                statusReportId: _newStatusReport.id,
              };
            }),
          )
          .returning()
      ).map((page) => page.pageId),
    );
  }

  if (monitors_id.length) {
    monitorToStatusIds.push(
      ...(
        await db
          .insert(monitorsToStatusReport)
          .values(
            monitors_id.map((id) => {
              return {
                monitorId: id,
                statusReportId: _newStatusReport.id,
              };
            }),
          )
          .returning()
      ).map((monitor) => monitor.monitorId),
    );
  }

  const { message: curMessage, date: curDate } = _statusReportHistory;
  const data = reportSchema.parse({
    ..._newStatusReport,
    message: curMessage,
    date: curDate,
    monitors_id: monitorToStatusIds.length ? monitorToStatusIds : null,
    pages_id: pageToStatusIds.length ? pageToStatusIds : null,
    status_report_updates: [_statusReportHistory.id],
  });

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
          schema: updateStatusReportSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: reportSchema,
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

  const { title, date, message, monitors_id, pages_id, status } = input;

  //  monitors check
  const associatedMonitorsId: number[] = [];
  const associatedPagesId: number[] = [];

  if (monitors_id) {
    let monitors: number[];
    if (monitors_id.length) {
      monitors = (
        await db.query.monitor.findMany({
          columns: {
            id: true,
          },
        })
      ).map((m) => m.id);

      const nonExistingId = monitors_id.filter((m) => !monitors.includes(m));

      if (nonExistingId.length) {
        return c.json(
          {
            code: 400,
            message: `monitor(s) with id [${nonExistingId}] doesn't exist `,
          },
          400,
        );
      }
    }
  }

  // pages check

  if (pages_id) {
    let pages: number[];
    if (pages_id.length) {
      pages = (
        await db.query.page.findMany({
          columns: {
            id: true,
          },
        })
      ).map((m) => m.id);

      const nonExistingId = pages_id.filter((m) => !pages.includes(m));

      if (nonExistingId.length) {
        return c.json(
          {
            code: 400,
            message: `page(s) with id [${nonExistingId}] doesn't exist `,
          },
          400,
        );
      }
    }
  }

  const [_updatedStatusReport, statusReportHistory] = await Promise.all([
    status || title
      ? db
          .update(statusReport)
          .set({ ...(status && { status }), ...(title && { title }) })
          .where(
            and(
              eq(statusReport.id, statusReportId),
              eq(statusReport.workspaceId, workspaceId),
            ),
          )
          .returning()
          .get()
      : db.query.statusReport.findFirst({
          where: and(
            eq(statusReport.id, statusReportId),
            eq(statusReport.workspaceId, workspaceId),
          ),
        }),
    db.query.statusReportUpdate.findMany({
      where: eq(statusReportUpdate.statusReportId, statusReportId),
      orderBy: asc(statusReportUpdate.createdAt),
    }),
  ]);

  if (!_updatedStatusReport)
    return c.json(
      {
        code: 404,
        message: `status report with id ${statusReportId} doesn't exist`,
      },
      404,
    );

  if (!statusReportHistory)
    return c.json(
      {
        code: 404,
        message: `status reports history with id ${statusReportId} doesn't exist`,
      },
      404,
    );

  const _mostRecentUpdate = statusReportHistory[statusReportHistory.length - 1];

  const {
    status: prevStatus,
    date: prevDate,
    message: prevMessage,
  } = _mostRecentUpdate;

  // only have status_report_update_changes in status_report_update_table
  // if anyone status | date | message was intended to update

  const isUpdates =
    status != undefined || date != undefined || message != undefined;

  const _statusReportUpdate = isUpdates
    ? await db
        .insert(statusReportUpdate)
        .values({
          status: status ? status : prevStatus,
          date: date ? new Date(date) : prevDate,
          message: message ? message : prevMessage,
          statusReportId: Number(id),
        })
        .returning()
        .get()
    : _mostRecentUpdate;

  if (monitors_id) {
    if (monitors_id.length) {
      const updateToNew = monitors_id.map((id) => {
        return { monitorId: id, statusReportId };
      });
      await db
        .delete(monitorsToStatusReport)
        .where(eq(monitorsToStatusReport.statusReportId, statusReportId));
      associatedMonitorsId.push(
        ...(
          await db
            .insert(monitorsToStatusReport)
            .values([...updateToNew])
            .returning()
        ).map((m) => m.monitorId),
      );
    } else {
      await db
        .delete(monitorsToStatusReport)
        .where(eq(monitorsToStatusReport.statusReportId, statusReportId));
    }
  } else {
    associatedMonitorsId.push(
      ...(
        await db.query.monitorsToStatusReport.findMany({
          where: eq(monitorsToStatusReport.statusReportId, statusReportId),
        })
      ).map((m) => m.monitorId),
    );
  }

  if (pages_id) {
    if (pages_id.length) {
      const updateToNew = pages_id.map((id) => {
        return { pageId: id, statusReportId };
      });

      await db
        .delete(pagesToStatusReports)
        .where(eq(pagesToStatusReports.statusReportId, statusReportId));

      associatedPagesId.push(
        ...(
          await db
            .insert(pagesToStatusReports)
            .values([...updateToNew])
            .returning()
        ).map((m) => m.pageId),
      );
    } else {
      await db
        .delete(pagesToStatusReports)
        .where(eq(pagesToStatusReports.statusReportId, statusReportId));
    }
  } else {
    associatedPagesId.push(
      ...(
        await db.query.pagesToStatusReports.findMany({
          where: eq(pagesToStatusReports.statusReportId, statusReportId),
        })
      ).map((p) => p.pageId),
    );
  }

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
        from: "Notification OpenStatus <notification@notifications.openstatus.dev>",
      });
    }
  }

  const {
    status: curStatus,
    date: curDate,
    message: curMessage,
  } = _statusReportUpdate;

  const { title: curTitle } = _updatedStatusReport;

  const status_report_updates = [
    ...statusReportHistory.map((report) => report.id),
  ];

  if (isUpdates) {
    status_report_updates.push(_statusReportUpdate.id);
  }

  const data = reportSchema.parse({
    id: statusReportId,
    title: curTitle,
    status: curStatus,
    date: curDate,
    message: curMessage,
    monitors_id: associatedMonitorsId.length ? associatedMonitorsId : null,
    pages_id: associatedPagesId.length ? associatedPagesId : null,
    status_report_updates,
  });

  return c.json({
    ...data,
  });
});

export { statusReportApi };
