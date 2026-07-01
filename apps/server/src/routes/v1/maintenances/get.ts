import { createRoute } from "@hono/zod-openapi";
import { db } from "@openstatus/db";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { notEmpty } from "@/utils/not-empty";

import type { maintenancesApi } from "./index";
import { MaintenanceSchema, ParamsSchema } from "./schema";

const getRoute = createRoute({
  method: "get",
  tags: ["maintenance"],
  summary: "Get a maintenance",
  path: "/{id}",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MaintenanceSchema,
        },
      },
      description: "Get a maintenance",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetMaintenance(api: typeof maintenancesApi) {
  return api.openapi(getRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const { id } = c.req.valid("param");

    const _maintenance = await db.query.maintenance.findFirst({
      with: {
        maintenancesToPageComponents: { with: { pageComponent: true } },
      },
      where: { id: Number(id), workspaceId },
    });

    if (!_maintenance) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Maintenance ${id} not found`,
      });
    }

    const data = MaintenanceSchema.parse({
      ..._maintenance,
      monitorIds: _maintenance.maintenancesToPageComponents
        .map((m) => m.pageComponent.monitorId)
        .filter(notEmpty),
    });

    return c.json(data, 200);
  });
}
