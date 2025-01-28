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
import { MaintenanceSchema } from "./schema";

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

    const data = MaintenanceSchema.parse({
      ..._maintenance,
      monitorIds: input.monitorIds,
    });

    return c.json(data, 200);
  });
}
