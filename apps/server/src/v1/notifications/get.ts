import { createRoute } from "@hono/zod-openapi";

import { and, db, eq } from "@openstatus/db";
import {
  notification,
  notificationsToMonitors,
  page,
} from "@openstatus/db/src/schema";
import { HTTPException } from "hono/http-exception";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import type { notificationsApi } from "./index";
import { NotificationSchema, ParamsSchema } from "./schema";

const getRoute = createRoute({
  method: "get",
  tags: ["notification"],
  description: "Get a notification",
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
    const workspaceId = c.get("workspaceId");
    const { id } = c.req.valid("param");

    const _notification = await db
      .select()
      .from(notification)
      .where(
        and(
          eq(page.workspaceId, Number(workspaceId)),
          eq(notification.id, Number(id))
        )
      )
      .get();

    if (!_notification) {
      throw new HTTPException(404, { message: "Not Found" });
    }

    const linkedMonitors = await db
      .select()
      .from(notificationsToMonitors)
      .where(eq(notificationsToMonitors.notificationId, Number(id)))
      .all();

    const monitors = linkedMonitors.map((m) => m.monitorId);

    const data = NotificationSchema.parse({
      ..._notification,
      payload: JSON.parse(_notification.data || "{}"),
      monitors,
    });

    return c.json(data, 200);
  });
}
