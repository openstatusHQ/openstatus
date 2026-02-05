import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, inArray, isNotNull, isNull } from "@openstatus/db";
import {
  monitor,
  page,
  pageComponent,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import { env } from "@/env";
import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { EmailClient } from "@openstatus/emails";
import type { statusReportsApi } from "./index";
import { StatusReportSchema } from "./schema";

const emailClient = new EmailClient({ apiKey: env.RESEND_API_KEY });

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
            date: z.coerce.date().optional().prefault(new Date()).openapi({
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
          message: `Some of the monitors ${input.monitorIds.join(
            ", ",
          )} not found`,
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

    if (!_newStatusReport.pageId) {
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: "Page ID is required",
      });
    }

    if (input.monitorIds?.length) {
      // Find matching page_components for the monitors on this page
      const components = await db
        .select({ id: pageComponent.id })
        .from(pageComponent)
        .where(
          and(
            inArray(pageComponent.monitorId, input.monitorIds),
            eq(pageComponent.pageId, _newStatusReport.pageId),
            eq(pageComponent.type, "monitor"),
          ),
        )
        .all();

      // Insert to statusReportsToPageComponents
      if (components.length > 0) {
        await db
          .insert(statusReportsToPageComponents)
          .values(
            components.map((c) => ({
              statusReportId: _newStatusReport.id,
              pageComponentId: c.id,
            })),
          )
          .run();
      }
    }

    if (limits["status-subscribers"] && _newStatusReport.pageId) {
      const subscribers = await db
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.pageId, _newStatusReport.pageId),
            isNotNull(pageSubscriber.acceptedAt),
            isNull(pageSubscriber.unsubscribedAt),
          ),
        )
        .all();

      const pageInfo = await db.query.page.findFirst({
        where: eq(page.id, _newStatusReport.pageId),
      });

      const _statusReport = await db.query.statusReport.findFirst({
        where: eq(statusReport.id, _newStatusReport.id),
        with: {
          statusReportsToPageComponents: {
            with: { pageComponent: true },
          },
        },
      });

      if (!_statusReport) {
        throw new OpenStatusApiError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Status report not found",
        });
      }

      const validSubscribers = subscribers.filter(
        (s): s is typeof s & { token: string } =>
          s.token !== null &&
          s.acceptedAt !== null &&
          s.unsubscribedAt === null,
      );
      if (pageInfo && validSubscribers.length > 0) {
        await emailClient.sendStatusReportUpdate({
          subscribers: validSubscribers.map((subscriber) => ({
            email: subscriber.email,
            token: subscriber.token,
          })),
          pageTitle: pageInfo.title,
          pageSlug: pageInfo.slug,
          customDomain: pageInfo.customDomain,
          reportTitle: _newStatusReport.title,
          status: _newStatusReportUpdate.status,
          message: _newStatusReportUpdate.message,
          date: _newStatusReportUpdate.date.toISOString(),
          pageComponents: _statusReport.statusReportsToPageComponents.map(
            (i) => i.pageComponent.name,
          ),
        });
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
