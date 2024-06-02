import { createRoute } from "@hono/zod-openapi";

import { and, db, eq, inArray, isNull } from "@openstatus/db";
import {
  NotificationDataSchema,
  monitor,
  notification,
  notificationsToMonitors,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";
import { openApiErrorResponses } from "../../libs/errors/openapi-error-responses";
import { NotificationSchema } from "./schema";
import type { notificationsApi } from "./index";
import { HTTPException } from "hono/http-exception";

const postRoute = createRoute({
  method: "post",
  tags: ["page"],
  description: "Create a notification",
  path: "/",
  request: {
    body: {
      description: "The notification to create",
      content: {
        "application/json": {
          schema: NotificationSchema.omit({ id: true }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: NotificationSchema,
        },
      },
      description: "Return the created notification",
    },
    ...openApiErrorResponses,
  },
});

export function registerPostNotification(api: typeof notificationsApi) {
  return api.openapi(postRoute, async (c) => {
    const workspaceId = c.get("workspaceId");
    const workspacePlan = c.get("workspacePlan");
    const input = c.req.valid("json");

    if (input.provider === "sms" && workspacePlan.title === "Hobby") {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    const { payload, monitors, ...rest } = input;

    if (monitors?.length) {
      const _monitors = await db
        .select()
        .from(monitor)
        .where(
          and(
            inArray(monitor.id, monitors),
            eq(monitor.workspaceId, Number(workspaceId)),
            isNull(monitor.deletedAt)
          )
        )
        .all();

      if (_monitors.length !== monitors.length) {
        throw new HTTPException(400, { message: "Monitor not found" });
      }
    }

    const _notification = await db
      .insert(notification)
      .values({
        ...rest,
        workspaceId: Number(workspaceId),
        data: JSON.stringify(payload),
      })
      .returning()
      .get();

    if (monitors?.length) {
      for (const monitorId of monitors) {
        await db
          .insert(notificationsToMonitors)
          .values({ notificationId: _notification.id, monitorId })
          .run();
      }
    }

    // FIXME: too complex
    const d = selectNotificationSchema.parse(_notification);

    const _payload = NotificationDataSchema.parse(JSON.parse(d.data));
    const data = NotificationSchema.parse({
      ..._notification,
      monitors,
      payload: _payload,
    });
    return c.json(data);
  });
}
