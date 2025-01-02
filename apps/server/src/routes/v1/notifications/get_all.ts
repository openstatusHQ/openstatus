import { createRoute } from "@hono/zod-openapi";

import { openApiErrorResponses } from "@/libs/errors";
import { db, eq, inArray } from "@openstatus/db";
import {
  notification,
  notificationsToMonitors,
} from "@openstatus/db/src/schema";
import type { notificationsApi } from "./index";
import { NotificationSchema } from "./schema";

const getAllRoute = createRoute({
  method: "get",
  tags: ["notification"],
  summary: "List all notifications",
  path: "/",

  responses: {
    200: {
      content: {
        "application/json": {
          schema: NotificationSchema.array(),
        },
      },
      description: "Get all your workspace notification",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetAllNotifications(app: typeof notificationsApi) {
  return app.openapi(getAllRoute, async (c) => {
    const workspaceId = c.get("workspace").id;

    const _notifications = await db
      .select()
      .from(notification)
      .where(eq(notification.workspaceId, workspaceId))
      .all();

    const _monitors = await db
      .select()
      .from(notificationsToMonitors)
      .where(
        inArray(
          notificationsToMonitors.notificationId,
          _notifications.map((n) => n.id),
        ),
      )
      .all();

    const data = NotificationSchema.array().parse(
      _notifications.map((n) => ({
        ...n,
        payload: JSON.parse(n.data || "{}"),
        monitors: _monitors
          .filter((m) => m.notificationId === n.id)
          .map((m) => m.monitorId),
      })),
    );

    return c.json(data, 200);
  });
}
