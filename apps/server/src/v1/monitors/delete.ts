import { createRoute, z } from "@hono/zod-openapi";

import { db, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { HTTPException } from "hono/http-exception";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import type { monitorsApi } from "./index";
import { ParamsSchema } from "./schema";

const deleteRoute = createRoute({
  method: "delete",
  tags: ["monitor"],
  description: "Delete a monitor",
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({}),
        },
      },
      description: "Delete the monitor",
    },
    ...openApiErrorResponses,
  },
});

export function registerDeleteMonitor(app: typeof monitorsApi) {
  return app.openapi(deleteRoute, async (c) => {
    const workspaceId = c.get("workspaceId");
    const { id } = c.req.valid("param");

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

    await db
      .update(monitor)
      .set({ active: false, deletedAt: new Date() })
      .where(eq(monitor.id, Number(id)))
      .run();

    // FIXME: Remove all relations of the monitor from all notifications, pages,....

    return c.json({});
  });
}
