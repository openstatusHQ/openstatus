import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, db, eq, isNotNull } from "@openstatus/db";
import {
    notification,
    notificationsToMonitors,
    notificationsToMonitorsRelation,
    notificationRelations,
    notificationProviderSchema,
    notificationProvider,


} from "@openstatus/db/src/schema/notifications";
import type { Variables } from "./index";
import { ErrorSchema } from "./shared";
import { isoDate } from "./utils";

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
        description: "The id of the Incident",
        example: "1",
      }),
  });

  const NotificationSchema = z.object({
    id: z.number().openapi({
      description: "The id of the notification",
      example: 1,
    }),
    name: z
      .string()
      .openapi({
        example: "Alert",
        description: "The name of the notification",
      })
      .nullable(),
      provider: notificationProviderSchema.openapi({
        description: "The provider for notification",
      }),
      data: z.string().openapi({
        example: "Hello World",
        description: "The data",
      }),

    createdAt: isoDate.openapi({
      description: "The date the incident started",
    }),
    updatedAt: isoDate.openapi({
        description: "The date the incident started",
      }),
  });

