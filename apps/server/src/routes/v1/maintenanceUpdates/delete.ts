import { createRoute } from "@hono/zod-openapi";
import { Events } from "@openstatus/analytics";
import { deleteMaintenanceUpdate } from "@openstatus/services/maintenance";

import { openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";

import type { maintenanceUpdatesApi } from "./index";
import { DeleteMaintenanceUpdateResponseSchema, ParamsSchema } from "./schema";
import { throwApiError, toServiceContext } from "./utils";

const route = createRoute({
  method: "delete",
  tags: ["maintenance_update"],
  summary: "Delete a maintenance update",
  path: "/{id}",
  middleware: [trackMiddleware(Events.DeleteMaintenanceUpdate)],
  request: { params: ParamsSchema },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DeleteMaintenanceUpdateResponseSchema,
        },
      },
      description: "The deletion result",
    },
    ...openApiErrorResponses,
  },
});

export function registerDeleteMaintenanceUpdate(
  api: typeof maintenanceUpdatesApi,
) {
  return api.openapi(route, async (c) => {
    try {
      await deleteMaintenanceUpdate({
        ctx: toServiceContext(c),
        input: { id: Number(c.req.valid("param").id) },
      });
      return c.json({ success: true }, 200);
    } catch (error) {
      throwApiError(error);
    }
  });
}
