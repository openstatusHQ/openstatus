import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import isEmail from "validator/lib/isEmail";
import isMobilePhone from "validator/lib/isMobilePhone";

import { and, db, eq, inArray } from "@openstatus/db";
import {
  monitor,
  notification,
  NotificationDataSchema,
  notificationProvider,
  notificationsToMonitors,
  page,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";

import type { Variables } from ".";
import { ErrorSchema } from "./shared";

const notificationApi = new OpenAPIHono<{ Variables: Variables }>();

const ParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the notification",
      example: "1",
    }),
});

const NotificationSchema = z.object({
  id: z
    .number()
    .openapi({ description: "The id of the notification", example: 1 }),
  name: z.string().openapi({
    description: "The name of the notification",
    example: "OpenStatus Discord",
  }),
  provider: z.enum(notificationProvider).openapi({
    description: "The provider of the notification",
    example: "discord",
  }),
  payload: NotificationDataSchema.openapi({
    description: "The data of the notification",
    examples: [
      { email: "ping@openstatus.dev" },
      { discord: "https://discord.com/api/webhooks/{channelId}/xxx..." },
    ],
  }),
  monitors: z
    .array(z.number())
    .openapi({
      description: "The monitors that the notification is linked to",
      example: [1, 2],
    })
    .nullish(),
});

const CreateNotificationSchema = z.object({
  name: z.string().openapi({
    description: "The name of the notification",
    example: "OpenStatus Discord",
  }),
  provider: z.enum(notificationProvider).openapi({
    description: "The provider of the notification",
    example: "discord",
  }),
  payload: NotificationDataSchema.openapi({
    description: "The data of the notification",
    examples: [
      { email: "ping@openstatus.dev" },
      { discord: "https://discord.com/api/webhooks/{channelId}/xxx..." },
    ],
  }),
  monitors: z
    .array(z.number())
    .openapi({
      description: "The monitors that the notification is linked to",
      example: [1, 2],
    })
    .nullish(),
});
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
    400: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});

notificationApi.openapi(getRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const { id } = c.req.valid("param");

  const notificationId = Number(id);
  const result = await db
    .select()
    .from(notification)
    .where(
      and(
        eq(page.workspaceId, workspaceId),
        eq(notification.id, notificationId),
      ),
    )
    .get();

  if (!result) return c.json({ code: 404, message: "Not Found" }, 404);
  const linkedMonitors = await db
    .select()
    .from(notificationsToMonitors)
    .where(eq(notificationsToMonitors.notificationId, notificationId))
    .all();

  const monitorsId = linkedMonitors.map((m) => m.monitorId);

  const data = NotificationSchema.parse({
    ...result,
    payload: JSON.parse(result.data || "{}"),
    monitors: monitorsId,
  });

  return c.json(data);
});

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
          schema: CreateNotificationSchema,
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
    400: {
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
      description: "Returns an error",
    },
  },
});

notificationApi.openapi(postRoute, async (c) => {
  const workspaceId = Number(c.get("workspaceId"));
  const workspacePlan = c.get("workspacePlan");
  const input = c.req.valid("json");
  console.log(input);
  if (input.provider === "sms" && workspacePlan.title === "free") {
    return c.json({ code: 403, message: "Forbidden" }, 403);
  }

  const { payload, monitors, ...rest } = input;
  if (monitors) {
    const monitorsData = await db
      .select()
      .from(monitor)
      .where(
        and(
          inArray(monitor.id, monitors),
          eq(monitor.workspaceId, workspaceId),
        ),
      )
      .all();
    if (monitorsData.length !== monitors.length)
      return c.json({ code: 400, message: "Monitor not found" }, 400);
  }

  const newNotif = await db
    .insert(notification)
    .values({
      workspaceId,
      ...rest,
      data: JSON.stringify(payload),
    })
    .returning()
    .get();

  console.log(newNotif);
  if (monitors) {
    for (const monitorId of monitors) {
      await db
        .insert(notificationsToMonitors)
        .values({ notificationId: newNotif.id, monitorId })
        .run();
    }
  }
  const d = selectNotificationSchema.parse(newNotif);

  const p = NotificationDataSchema.parse(JSON.parse(d.data));
  const data = NotificationSchema.parse({
    ...newNotif,
    monitors: monitors,
    payload: p,
  });
  return c.json(data);
});

export { notificationApi };
