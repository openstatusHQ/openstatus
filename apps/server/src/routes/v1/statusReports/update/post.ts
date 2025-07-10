import { env } from "@/env";
import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { createRoute } from "@hono/zod-openapi";
import { and, db, eq, isNotNull } from "@openstatus/db";
import {
  pageSubscriber,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import { EmailClient } from "@openstatus/emails/src/client";
import { StatusReportUpdateSchema } from "../../statusReportUpdates/schema";
import type { statusReportsApi } from "../index";
import { ParamsSchema, StatusReportSchema } from "../schema";

const emailClient = new EmailClient({ apiKey: env.RESEND_API_KEY });

const postRouteUpdate = createRoute({
  method: "post",
  tags: ["status_report"],
  path: "/{id}/update",
  summary: "Create a status report update",
  deprecated: true,
  description:
    "Preferably use [`/status-report-updates`](#tag/status_report_update/POST/status_report_update) instead.",
  request: {
    params: ParamsSchema,
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
          schema: StatusReportSchema,
        },
      },
      description: "Status report updated",
    },
    ...openApiErrorResponses,
  },
});

export function registerStatusReportUpdateRoutes(api: typeof statusReportsApi) {
  return api.openapi(postRouteUpdate, async (c) => {
    const input = c.req.valid("json");
    const { id } = c.req.valid("param");
    const workspaceId = c.get("workspace").id;
    const limits = c.get("workspace").limits;

    const _statusReport = await db
      .update(statusReport)
      .set({ status: input.status })
      .where(
        and(
          eq(statusReport.id, Number(id)),
          eq(statusReport.workspaceId, workspaceId)
        )
      )
      .returning()
      .get();

    if (!_statusReport) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Status Report ${id} not found`,
      });
    }

    const _statusReportUpdate = await db
      .insert(statusReportUpdate)
      .values({
        status: input.status,
        message: input.message,
        date: input.date,
        statusReportId: Number(id),
      })
      .returning()
      .get();

    if (limits.notifications && _statusReport.pageId) {
      const _statusReportWithRelations = await db.query.statusReport.findFirst({
        where: eq(statusReport.id, Number(id)),
        with: {
          monitorsToStatusReports: {
            with: {
              monitor: true,
            },
          },
          page: true,
        },
      });

      const subscribers = await db
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.pageId, _statusReport.pageId),
            isNotNull(pageSubscriber.acceptedAt)
          )
        )
        .all();

      if (_statusReportWithRelations?.page) {
        await emailClient.sendStatusReportUpdate({
          to: subscribers.map((subscriber) => subscriber.email),
          pageTitle: _statusReportWithRelations.page.title,
          reportTitle: _statusReportWithRelations.title,
          status: _statusReportWithRelations.status,
          message: _statusReportUpdate.message,
          date: _statusReportUpdate.date.toISOString(),
          monitors: _statusReportWithRelations.monitorsToStatusReports.map(
            (monitor) => monitor.monitor.name
          ),
        });
      }
    }

    const data = StatusReportSchema.parse(_statusReportUpdate);

    return c.json(data, 200);
  });
}
