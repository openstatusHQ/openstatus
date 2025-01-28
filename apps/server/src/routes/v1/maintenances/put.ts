import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { createRoute } from "@hono/zod-openapi";
import { Events } from "@openstatus/analytics";
import { and, db, eq, inArray, isNull } from "@openstatus/db";
import { monitor, page } from "@openstatus/db/src/schema";
import {
  maintenance,
  maintenancesToMonitors,
} from "@openstatus/db/src/schema/maintenances";
import type { maintenancesApi } from "./index";
import { MaintenanceSchema, ParamsSchema } from "./schema";

const putRoute = createRoute({
  method: "put",
  tags: ["maintenance"],
  summary: "Update a maintenance",
  path: "/:id",
  middleware: [trackMiddleware(Events.UpdateMaintenance)],
  request: {
    params: ParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: MaintenanceSchema.omit({ id: true }).partial(),
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
      description: "Update a maintenance",
    },
    ...openApiErrorResponses,
  },
});

export function registerPutMaintenance(api: typeof maintenancesApi) {
  return api.openapi(putRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const { monitorIds, pageId } = input;

    const _maintenance = await db.query.maintenance.findFirst({
      with: {
        maintenancesToMonitors: true,
      },
      where: and(
        eq(maintenance.id, Number(id)),
        eq(maintenance.workspaceId, workspaceId),
      ),
    });

    if (!_maintenance) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Maintenance ${id} not found`,
      });
    }

    if (monitorIds?.length) {
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
    }

    if (pageId) {
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
    }

    const updatedMaintenance = await db.transaction(async (tx) => {
      const updated = await tx
        .update(maintenance)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(maintenance.id, Number(id)))
        .returning()
        .get();

      if (monitorIds) {
        // Delete existing monitor associations
        await tx
          .delete(maintenancesToMonitors)
          .where(eq(maintenancesToMonitors.maintenanceId, Number(id)))
          .run();

        // Add new monitor associations
        if (monitorIds.length > 0) {
          await tx
            .insert(maintenancesToMonitors)
            .values(
              monitorIds.map((monitorId) => ({
                maintenanceId: Number(id),
                monitorId,
              })),
            )
            .run();
        }
      }

      return updated;
    });

    const data = MaintenanceSchema.parse({
      ...updatedMaintenance,
      monitorIds:
        monitorIds ??
        _maintenance.maintenancesToMonitors.map((m) => m.monitorId),
    });

    return c.json(data, 200);
  });
}
