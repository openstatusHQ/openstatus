import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, isNotNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import type { monitorsApi } from "./index";
import { MonitorSchema, ParamsSchema } from "./schema";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";

const getRoute = createRoute({
  method: "get",
  tags: ["monitor"],
  description: "Get a monitor",
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MonitorSchema,
        },
      },
      description: "The monitor",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetMonitor(api: typeof monitorsApi) {
  return api.openapi(getRoute, async (c) => {
    const workspaceId = c.get("workspaceId");
    const { id } = c.req.valid("param");

    const _monitor = await db
      .select()
      .from(monitor)
      .where(
        and(
          eq(monitor.id, Number(id)),
          eq(monitor.workspaceId, Number(workspaceId)),
          isNotNull(monitor.deletedAt),
        ),
      )
      .get();

    if (!_monitor) return c.json({ code: 404, message: "Not Found" }, 404);

    const data = MonitorSchema.parse(_monitor);

    return c.json(data);
  });
}
