import { z } from "@hono/zod-openapi";

import { notificationProvider } from "@openstatus/db/src/schema/notifications/constants";

export const ParamsSchema = z.object({
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

export const NotificationSchema = z
  .object({
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
    payload: z.any().openapi({
      description: "The data of the notification",
    }),
    monitors: z
      .array(z.number())
      .nullish()
      .openapi({
        description: "The monitors that the notification is linked to",
        example: [1, 2],
      }),
  })
  .openapi("Notification");

export type NotificationSchema = z.infer<typeof NotificationSchema>;
