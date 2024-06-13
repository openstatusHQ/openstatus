import { createRoute, z } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import {
  notification,
  notificationsToMonitors,
  page,
} from "@openstatus/db/src/schema";
import { HTTPException } from "hono/http-exception";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import type { notificationsApi } from "./index";
import { NotificationSchema } from "./schema";

const getAllRoute = createRoute({
  method: "get",
  tags: ["notification"],
  description: "Get a notification",
  path: "/",

  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(NotificationSchema),
        },
      },
      description: "Get all your workspace notification",
    },
    ...openApiErrorResponses,
  },
});

export function registerGetAllNotifications(app: typeof notificationsApi) {
  return app.openapi(getAllRoute, async (c) => {
    const workspaceId = c.get("workspaceId");

    const _incidents = await db
      .select()
      .from(notification)
      .where(and(eq(page.workspaceId, Number(workspaceId))))
      .all();

    if (!_incidents) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const data = [];

    for (const _incident of _incidents) {
      const linkedMonitors = await db
        .select()
        .from(notificationsToMonitors)
        .where(eq(notificationsToMonitors.notificationId, _incident.id))
        .all();

      const monitors = linkedMonitors.map((m) => m.monitorId);

      const p = NotificationSchema.parse({
        ..._incidents,
        payload: JSON.parse(_incident.data || "{}"),
        monitors,
      });

      data.push(p);
    }

    return c.json(data);
  });
}
