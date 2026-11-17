import { createRoute, z } from "@hono/zod-openapi";
import { Events } from "@openstatus/analytics";
import { and, db, eq, isNull, ne } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import {
  maintenanceIdsBehind,
  syncDerivedWindows,
} from "@openstatus/services/maintenance";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { trackMiddleware } from "@/libs/middlewares";

import { v1ServiceCtx } from "../utils";
import type { monitorsApi } from "./index";
import { ParamsSchema } from "./schema";

const deleteRoute = createRoute({
  method: "delete",
  tags: ["monitor"],
  summary: "Delete a monitor",
  path: "/{id}",
  request: {
    params: ParamsSchema,
  },
  middleware: [trackMiddleware(Events.DeleteMonitor)],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({}),
        },
      },
      description: "The monitor was successfully deleted",
    },
    ...openApiErrorResponses,
  },
});

export function registerDeleteMonitor(app: typeof monitorsApi) {
  return app.openapi(deleteRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const { id } = c.req.valid("param");

    const _monitor = await db
      .select()
      .from(monitor)
      .where(
        and(
          eq(monitor.id, Number(id)),
          eq(monitor.workspaceId, workspaceId),
          isNull(monitor.deletedAt),
          ne(monitor.jobType, "heartbeat"),
        ),
      )
      .get();

    if (!_monitor) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Monitor ${id} not found`,
      });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(monitor)
        .set({ active: false, deletedAt: new Date() })
        .where(eq(monitor.id, Number(id)))
        .run();
      await syncDerivedWindows(
        tx,
        v1ServiceCtx(c),
        await maintenanceIdsBehind(tx, workspaceId, {
          monitorIds: [Number(id)],
        }),
      );
    });

    // FIXME: Remove all relations of the monitor from all notifications, pages,....

    return c.json({}, 200);
  });
}
