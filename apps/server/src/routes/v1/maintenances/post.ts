import { env } from "@/env";
import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { createRoute } from "@hono/zod-openapi";
import { Events } from "@openstatus/analytics";
import {
  and,
  db,
  eq,
  inArray,
  isNotNull,
  isNull,
  syncMaintenanceToMonitorInsertMany,
} from "@openstatus/db";
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

    if (input.from > input.to) {
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: "`date.from` cannot be after `date.to`",
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

    const _newMaintenance = await db.transaction(async (tx) => {
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
        // Sync to page components
        await syncMaintenanceToMonitorInsertMany(
          tx,
          newMaintenance.id,
          input.monitorIds,
        );
      }

      return newMaintenance;
    });

    if (limits["status-subscribers"] && _newMaintenance.pageId) {
      const subscribers = await db
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.pageId, _newMaintenance.pageId),
            isNotNull(pageSubscriber.acceptedAt),
            isNull(pageSubscriber.unsubscribedAt),
          ),
        )
        .all();

      const _page = await db.query.page.findFirst({
        where: and(
          eq(page.id, _newMaintenance.pageId),
          eq(page.workspaceId, workspaceId),
        ),
      });

      const _maintenance = await db.query.maintenance.findFirst({
        where: eq(maintenance.id, _newMaintenance.id),
        with: {
          maintenancesToPageComponents: {
            with: {
              pageComponent: true,
            },
          },
        },
      });

      if (!_maintenance) {
        throw new OpenStatusApiError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Maintenance not found",
        });
      }

      const validSubscribers = subscribers.filter(
        (s): s is typeof s & { token: string } =>
          s.token !== null &&
          s.acceptedAt !== null &&
          s.unsubscribedAt === null,
      );
      if (_page && validSubscribers.length > 0) {
        await emailClient.sendStatusReportUpdate({
          subscribers: validSubscribers.map((subscriber) => ({
            email: subscriber.email,
            token: subscriber.token,
          })),
          pageTitle: _page.title,
          pageSlug: _page.slug,
          customDomain: _page.customDomain,
          reportTitle: _maintenance.title,
          status: "maintenance",
          message: _maintenance.message,
          date: _maintenance.from.toISOString(),
          pageComponents: _maintenance.maintenancesToPageComponents.map(
            (i) => i.pageComponent.name,
          ),
        });
      }
    }

    const data = MaintenanceSchema.parse({
      ..._newMaintenance,
      monitorIds: input.monitorIds,
    });

    return c.json(data, 200);
  });
}
