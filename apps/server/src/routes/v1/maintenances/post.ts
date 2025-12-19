import { env } from "@/env";
import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { createRoute } from "@hono/zod-openapi";
import { Events } from "@openstatus/analytics";
import { and, db, eq, inArray, isNotNull, isNull } from "@openstatus/db";
import { monitor, page, pageSubscriber } from "@openstatus/db/src/schema";
import {
  maintenance,
  maintenancesToMonitors,
} from "@openstatus/db/src/schema/maintenances";
import { EmailClient } from "@openstatus/emails";
import type { maintenancesApi } from "./index";
import { MaintenanceSchema } from "./schema";

const emailClient = new EmailClient({ apiKey: env.RESEND_API_KEY });

const postRoute = createRoute({
  method: "post",
  tags: ["maintenance"],
  summary: "Create a maintenance",
  path: "/",
  middleware: [trackMiddleware(Events.CreateMaintenance)],
  request: {
    body: {
      content: {
        "application/json": {
          schema: MaintenanceSchema.omit({ id: true }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MaintenanceSchema,
        },
      },
      description: "Create a maintenance",
    },
    ...openApiErrorResponses,
  },
});

export function registerPostMaintenance(api: typeof maintenancesApi) {
  return api.openapi(postRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const input = c.req.valid("json");
    const limits = c.get("workspace").limits;

    const { monitorIds, pageId } = input;

    const _monitors = await db
      .select()
      .from(monitor)
      .where(
        and(
          inArray(monitor.id, monitorIds),
          eq(monitor.workspaceId, workspaceId),
          isNull(monitor.deletedAt),
        ),
      )
      .all();

    if (_monitors.length !== monitorIds.length) {
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: `Some of the monitors ${monitorIds.join(", ")} not found`,
      });
    }

    const _page = await db
      .select()
      .from(page)
      .where(and(eq(page.id, pageId), eq(page.workspaceId, workspaceId)))
      .get();

    if (!_page) {
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: `Page ${pageId} not found`,
      });
    }

    const _maintenance = await db.transaction(async (tx) => {
      const newMaintenance = await tx
        .insert(maintenance)
        .values({
          ...input,
          workspaceId,
        })
        .returning()
        .get();

      if (monitorIds?.length) {
        await tx
          .insert(maintenancesToMonitors)
          .values(
            input.monitorIds.map((monitorId) => ({
              maintenanceId: newMaintenance.id,
              monitorId,
            })),
          )
          .run();
      }

      return newMaintenance;
    });

    if (limits["status-subscribers"] && _maintenance.pageId) {
      const subscribers = await db
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.pageId, _maintenance.pageId),
            isNotNull(pageSubscriber.acceptedAt),
          ),
        )
        .all();

      const _page = await db.query.page.findFirst({
        where: and(
          eq(page.id, _maintenance.pageId),
          eq(page.workspaceId, workspaceId),
        ),
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
          reportTitle: _maintenance.title,
          status: "maintenance",
          message: _maintenance.message,
          date: _maintenance.from.toISOString(),
          monitors: _page.monitorsToPages.map(
            (i) => i.monitor.externalName || i.monitor.name,
          ),
        });
      }
    }

    const data = MaintenanceSchema.parse({
      ..._maintenance,
      monitorIds: input.monitorIds,
    });

    return c.json(data, 200);
  });
}
