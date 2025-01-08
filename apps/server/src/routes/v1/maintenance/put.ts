import { createRoute } from "@hono/zod-openapi";
import { and, db, eq } from "@openstatus/db";
import {
  maintenance,
  maintenancesToMonitors,
} from "@openstatus/db/src/schema/maintenances";
import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { Events } from "@openstatus/analytics";
import type { maintenanceApi } from "./index";
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

export function registerPutMaintenance(api: typeof maintenanceApi) {
  return api.openapi(putRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const _maintenance = await db.query.maintenance.findFirst({
      with: {
        maintenancesToMonitors: true,
      },
      where: and(
        eq(maintenance.id, Number(id)),
        eq(maintenance.workspaceId, workspaceId)
      ),
    });

    if (!_maintenance) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Maintenance ${id} not found`,
      });
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

      if (input.monitorIds) {
        // Delete existing monitor associations
        await tx
          .delete(maintenancesToMonitors)
          .where(eq(maintenancesToMonitors.maintenanceId, Number(id)))
          .run();

        // Add new monitor associations
        if (input.monitorIds.length > 0) {
          await tx
            .insert(maintenancesToMonitors)
            .values(
              input.monitorIds.map((monitorId) => ({
                maintenanceId: Number(id),
                monitorId,
              }))
            )
            .run();
        }
      }

      return updated;
    });

    const data = MaintenanceSchema.parse({
      ...updatedMaintenance,
      monitorIds:
        input.monitorIds ??
        _maintenance.maintenancesToMonitors.map((m) => m.monitorId),
    });

    return c.json(data, 200);
  });
}
