import { createRoute, z } from "@hono/zod-openapi";

import { db, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { MonitorSchema, ParamsSchema } from "./schema";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import type { monitorsApi } from "./index";
import { HTTPException } from "hono/http-exception";

const putRoute = createRoute({
  method: "put",
  tags: ["monitor"],
  description: "Update a monitor",
  path: "/:id",
  request: {
    params: ParamsSchema,
    body: {
      description: "The monitor to update",
      content: {
        "application/json": {
          schema: MonitorSchema.omit({ id: true }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MonitorSchema,
        },
      },
      description: "Update a monitor",
    },
    ...openApiErrorResponses,
  },
});

export function registerPutMonitor(api: typeof monitorsApi) {
  return api.openapi(putRoute, async (c) => {
    const workspaceId = c.get("workspaceId");
    const workspacePlan = c.get("workspacePlan");
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    if (!workspacePlan.limits.periodicity.includes(input.periodicity)) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    const _monitor = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, Number(id)))
      .get();

    if (!_monitor) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    if (Number(workspaceId) !== _monitor.workspaceId) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const { headers, regions, ...rest } = input;

    const _newMonitor = await db
      .update(monitor)
      .set({
        ...rest,
        regions: regions ? regions.join(",") : undefined,
        headers: input.headers ? JSON.stringify(input.headers) : undefined,
      })
      .returning()
      .get();

    const data = MonitorSchema.parse(_newMonitor);

    return c.json(data);
  });
}
