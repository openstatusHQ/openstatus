import { openApiErrorResponses } from "@/libs/errors";
import { createRoute } from "@hono/zod-openapi";
import { db, desc, eq } from "@openstatus/db";
import { maintenance } from "@openstatus/db/src/schema/maintenances";
import type { maintenancesApi } from "./index";
import { MaintenanceSchema } from "./schema";

const getAllRoute = createRoute({
  method: "get",
  tags: ["maintenance"],
  summary: "List all maintenances",
  path: "/",
  request: {},
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MaintenanceSchema.array(),
        },
      },
      description: "Get all maintenances",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetAllMaintenances(api: typeof maintenancesApi) {
  return api.openapi(getAllRoute, async (c) => {
    const workspaceId = c.get("workspace").id;

    const _maintenances = await db.query.maintenance.findMany({
      with: {
        maintenancesToMonitors: true,
      },
      where: eq(maintenance.workspaceId, workspaceId),
      orderBy: desc(maintenance.createdAt),
    });

    const data = MaintenanceSchema.array().parse(
      _maintenances.map((m) => ({
        ...m,
        monitorIds: m.maintenancesToMonitors.map((mtm) => mtm.monitorId),
      })),
    );

    return c.json(data, 200);
  });
}
