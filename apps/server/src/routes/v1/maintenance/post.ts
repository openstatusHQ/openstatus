import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";
import { createRoute } from "@hono/zod-openapi";
import { Events } from "@openstatus/analytics";
import { db } from "@openstatus/db";
import {
  maintenance,
  maintenancesToMonitors,
} from "@openstatus/db/src/schema/maintenances";
import type { maintenanceApi } from "./index";
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

export function registerPostMaintenance(api: typeof maintenanceApi) {
  return api.openapi(postRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const input = c.req.valid("json");

    const _maintenance = await db.transaction(async (tx) => {
      const newMaintenance = await tx
        .insert(maintenance)
        .values({
          ...input,
          workspaceId,
        })
        .returning()
        .get();

      if (input.monitorIds?.length) {
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
