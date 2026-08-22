import { createRoute } from "@hono/zod-openapi";
import { getMaintenanceUpdate } from "@openstatus/services/maintenance";

import { openApiErrorResponses } from "@/libs/errors";

import type { maintenanceUpdatesApi } from "./index";
import { MaintenanceUpdateSchema, ParamsSchema } from "./schema";
import { throwApiError, toServiceContext } from "./utils";

const route = createRoute({
  method: "get",
  tags: ["maintenance_update"],
  summary: "Get a maintenance update",
  path: "/{id}",
  request: { params: ParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: MaintenanceUpdateSchema } },
      description: "The maintenance update",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetMaintenanceUpdate(
  api: typeof maintenanceUpdatesApi,
) {
  return api.openapi(route, async (c) => {
    try {
      const update = await getMaintenanceUpdate({
        ctx: toServiceContext(c),
        input: { id: Number(c.req.valid("param").id) },
      });
      return c.json(MaintenanceUpdateSchema.parse(update), 200);
    } catch (error) {
      throwApiError(error);
    }
  });
}
