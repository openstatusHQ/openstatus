import { createRoute } from "@hono/zod-openapi";
import { Events } from "@openstatus/analytics";
import {
  addMaintenanceUpdate,
  notifyMaintenance,
} from "@openstatus/services/maintenance";

import { openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";

import type { maintenanceUpdatesApi } from "./index";
import {
  CreateMaintenanceUpdateSchema,
  MaintenanceUpdateSchema,
} from "./schema";
import { throwApiError, toServiceContext } from "./utils";

const route = createRoute({
  method: "post",
  tags: ["maintenance_update"],
  summary: "Create a maintenance update",
  path: "/",
  middleware: [trackMiddleware(Events.CreateMaintenanceUpdate)],
  request: {
    body: {
      content: {
        "application/json": { schema: CreateMaintenanceUpdateSchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: MaintenanceUpdateSchema } },
      description: "The created maintenance update",
    },
    ...openApiErrorResponses,
  },
});

export function registerPostMaintenanceUpdate(
  api: typeof maintenanceUpdatesApi,
) {
  return api.openapi(route, async (c) => {
    try {
      const input = c.req.valid("json");
      const ctx = toServiceContext(c);
      const result = await addMaintenanceUpdate({ ctx, input });
      if (input.notify) {
        await notifyMaintenance({
          ctx,
          input: { maintenanceUpdateId: result.maintenanceUpdate.id },
        });
      }
      return c.json(
        MaintenanceUpdateSchema.parse(result.maintenanceUpdate),
        200,
      );
    } catch (error) {
      throwApiError(error);
    }
  });
}
