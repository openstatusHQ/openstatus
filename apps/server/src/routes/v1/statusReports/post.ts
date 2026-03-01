import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, inArray, isNull } from "@openstatus/db";
import {
  monitor,
  page,
  pageComponent,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { dispatchStatusReportUpdate } from "@openstatus/subscriptions";
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

    const { _newStatusReport, _newStatusReportUpdate } = await db.transaction(
      async (tx) => {
        const _newStatusReport = await tx
          .insert(statusReport)
          .values({
            status: input.status,
            title: input.title,
            pageId: input.pageId,
            workspaceId: workspaceId,
          })
          .returning()
          .get();

        const _newStatusReportUpdate = await tx
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
          const components = await tx
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
            await tx
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

        return { _newStatusReport, _newStatusReportUpdate };
      },
    );

    if (limits["status-subscribers"] && _newStatusReport.pageId) {
      await dispatchStatusReportUpdate(_newStatusReportUpdate.id);
    }

    const data = StatusReportSchema.parse({
      ..._newStatusReport,
      monitorIds: input.monitorIds,
      statusReportUpdateIds: [_newStatusReportUpdate.id],
    });

    return c.json(data, 200);
  });
}
