import { createRoute } from "@hono/zod-openapi";
import { db, eq, inArray } from "@openstatus/db";
import {
  notification,
  notificationsToMonitors,
} from "@openstatus/db/src/schema";

import { openApiErrorResponses } from "@/libs/errors";

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

    const monitorsByNotification = new Map<number, number[]>();
    for (const { notificationId, monitorId } of _monitors) {
      const monitorIds = monitorsByNotification.get(notificationId);
      if (monitorIds) monitorIds.push(monitorId);
      else monitorsByNotification.set(notificationId, [monitorId]);
    }

    const data = NotificationSchema.array().parse(
      _notifications.map((n) => ({
        ...n,
        payload: JSON.parse(n.data || "{}"),
        monitors: monitorsByNotification.get(n.id) ?? [],
      })),
    );

    return c.json(data, 200);
  });
}
