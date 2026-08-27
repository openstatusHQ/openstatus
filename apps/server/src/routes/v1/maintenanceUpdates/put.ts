import { createRoute } from "@hono/zod-openapi";
import { Events } from "@openstatus/analytics";
import { updateMaintenanceUpdate } from "@openstatus/services/maintenance";

import { openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";

import type { maintenanceUpdatesApi } from "./index";
import {
  MaintenanceUpdateSchema,
  ParamsSchema,
  UpdateMaintenanceUpdateSchema,
} from "./schema";
import { throwApiError, toServiceContext } from "./utils";

const route = createRoute({
  method: "put",
  tags: ["maintenance_update"],
  summary: "Update a maintenance update",
  path: "/{id}",
  middleware: [trackMiddleware(Events.UpdateMaintenanceUpdate)],
  request: {
    params: ParamsSchema,
    body: {
      content: {
        "application/json": { schema: UpdateMaintenanceUpdateSchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: MaintenanceUpdateSchema } },
      description: "The updated maintenance update",
    },
    ...openApiErrorResponses,
  },
});

export function registerPutMaintenanceUpdate(
  api: typeof maintenanceUpdatesApi,
) {
  return api.openapi(route, async (c) => {
    try {
      const update = await updateMaintenanceUpdate({
        ctx: toServiceContext(c),
        input: {
          id: Number(c.req.valid("param").id),
          ...c.req.valid("json"),
        },
      });
      return c.json(MaintenanceUpdateSchema.parse(update), 200);
    } catch (error) {
      throwApiError(error);
    }
  });
}
