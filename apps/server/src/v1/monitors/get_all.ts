import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import type { monitorsApi } from "./index";
import { MonitorSchema } from "./schema";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { HTTPException } from "hono/http-exception";

const getAllRoute = createRoute({
  method: "get",
  tags: ["monitor"],
  description: "Get all monitors",
  path: "/",
  request: {},
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(MonitorSchema),
        },
      },
      description: "All the monitors",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetAllMonitors(app: typeof monitorsApi) {
  return app.openapi(getAllRoute, async (c) => {
    const workspaceId = c.get("workspaceId");

    const _monitors = await db
      .select()
      .from(monitor)
      .where(
        and(
          eq(monitor.workspaceId, Number(workspaceId)),
          isNull(monitor.deletedAt)
        )
      )
      .all();

    if (!_monitors) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const data = z.array(MonitorSchema).parse(_monitors);

    return c.json(data);
  });
}
