import { createRoute } from "@hono/zod-openapi";

import { and, db, eq, isNotNull } from "@openstatus/db";
import {
  page,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";

import { env } from "@/env";
import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { EmailClient } from "@openstatus/emails";
import type { statusReportUpdatesApi } from "./index";
import { StatusReportUpdateSchema } from "./schema";

const emailClient = new EmailClient({ apiKey: env.RESEND_API_KEY });

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
        monitorsToStatusReports: {
          with: {
            monitor: true,
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

      const _page = await db.query.page.findFirst({
        where: eq(page.id, _statusReport.pageId),
        with: {
          monitorsToPages: {
            with: {
              monitor: true,
            },
          },
        },
      });

      if (_page && subscribers.length > 0) {
        await emailClient.sendStatusReportUpdate({
          to: subscribers.map((subscriber) => subscriber.email),
          pageTitle: _page.title,
          reportTitle: _statusReport.title,
          status: _statusReport.status,
          message: _statusReportUpdate.message,
          date: _statusReportUpdate.date.toISOString(),
          monitors: _statusReport.monitorsToStatusReports.map(
            (i) => i.monitor.name,
          ),
        });
      }
    }

    const data = StatusReportUpdateSchema.parse(_statusReportUpdate);

    return c.json(data, 200);
  });
}
