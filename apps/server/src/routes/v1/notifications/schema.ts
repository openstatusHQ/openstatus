import { z } from "@hono/zod-openapi";
import {
  NotificationDataSchema,
  notificationProviderSchema,
} from "@openstatus/db/src/schema";

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
    provider: notificationProviderSchema.openapi({
      description: "The provider of the notification",
      example: "discord",
    }),
    payload: NotificationDataSchema.openapi({
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
