import { env } from "@/env";
import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { notEmpty } from "@/utils/not-empty";
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
          schema: StatusReportUpdateSchema.omit({
            id: true,
            statusReportId: true,
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
      .set({ status: input.status, updatedAt: new Date() })
      .where(
        and(
          eq(statusReport.id, Number(id)),
          eq(statusReport.workspaceId, workspaceId),
        ),
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

    if (limits["status-subscribers"] && _statusReport.pageId) {
      const _statusReportWithRelations = await db.query.statusReport.findFirst({
        where: eq(statusReport.id, Number(id)),
        with: {
          statusReportsToPageComponents: {
            with: {
              pageComponent: true,
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
            isNotNull(pageSubscriber.acceptedAt),
          ),
        )
        .all();

      const validSubscribers = subscribers.filter(
        (s): s is typeof s & { token: string } =>
          s.token !== null &&
          s.acceptedAt !== null &&
          s.unsubscribedAt === null,
      );
      if (_statusReportWithRelations?.page && validSubscribers.length > 0) {
        await emailClient.sendStatusReportUpdate({
          subscribers: validSubscribers.map((subscriber) => ({
            email: subscriber.email,
            token: subscriber.token,
          })),
          pageTitle: _statusReportWithRelations.page.title,
          pageSlug: _statusReportWithRelations.page.slug,
          customDomain: _statusReportWithRelations.page.customDomain,
          reportTitle: _statusReportWithRelations.title,
          status: _statusReportUpdate.status,
          message: _statusReportUpdate.message,
          date: _statusReportUpdate.date.toISOString(),
          pageComponents:
            _statusReportWithRelations.statusReportsToPageComponents.map(
              (i) => i.pageComponent.name,
            ),
        });
      }
    }

    // Query the full status report with all its relationships
    const fullStatusReport = await db.query.statusReport.findFirst({
      where: eq(statusReport.id, Number(id)),
      with: {
        statusReportUpdates: true,
        statusReportsToPageComponents: {
          with: {
            pageComponent: true,
          },
        },
      },
    });

    if (!fullStatusReport) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Status Report ${id} not found`,
      });
    }

    const data = StatusReportSchema.parse({
      ...fullStatusReport,
      statusReportUpdateIds: fullStatusReport.statusReportUpdates.map(
        (u) => u.id,
      ),
      monitorIds: fullStatusReport.statusReportsToPageComponents
        .map((m) => m.pageComponent.monitorId)
        .filter(notEmpty),
    });

    return c.json(data, 200);
  });
}
