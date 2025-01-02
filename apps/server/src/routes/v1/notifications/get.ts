import { createRoute } from "@hono/zod-openapi";

import { OpenStatusApiError, openApiErrorResponses } from "@/libs/errors";
import { and, db, eq } from "@openstatus/db";
import {
  notification,
  notificationsToMonitors,
} from "@openstatus/db/src/schema";
import type { notificationsApi } from "./index";
import { NotificationSchema, ParamsSchema } from "./schema";

const getRoute = createRoute({
  method: "get",
  tags: ["notification"],
  summary: "Get a notification",
  path: "/:id",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: NotificationSchema,
        },
      },
      description: "Get an Status page",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetNotification(api: typeof notificationsApi) {
  return api.openapi(getRoute, async (c) => {
    const workspaceId = c.get("workspace").id;
    const { id } = c.req.valid("param");

    const _notification = await db
      .select()
      .from(notification)
      .where(
        and(
          eq(notification.workspaceId, workspaceId),
          eq(notification.id, Number(id)),
        ),
      )
      .get();

    if (!_notification) {
      throw new OpenStatusApiError({
        code: "NOT_FOUND",
        message: `Notification ${id} not found`,
      });
    }

    const _monitors = await db
      .select()
      .from(notificationsToMonitors)
      .where(eq(notificationsToMonitors.notificationId, Number(id)))
      .all();

    const data = NotificationSchema.parse({
      ..._notification,
      payload: JSON.parse(_notification.data || "{}"),
      monitors: _monitors.map((m) => m.monitorId),
    });

    return c.json(data, 200);
  });
}
