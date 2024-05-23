import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as z from "zod";

import { notificationProvider } from "./constants";
import { notification } from "./notification";

export const notificationProviderSchema = z.enum(notificationProvider);

export const selectNotificationSchema = createSelectSchema(notification).extend(
  {
    data: z
      .preprocess((val) => {
        return String(val);
      }, z.string())
      .default("{}"),
  },
);

// we need to extend, otherwise data can be `null` or `undefined` - default is not
export const insertNotificationSchema = createInsertSchema(notification).extend(
  {
    data: z.string().default("{}"),
  },
);

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = z.infer<typeof selectNotificationSchema>;
export type NotificationProvider = z.infer<typeof notificationProviderSchema>;

export const NotificationDataSchema = z.union([
  z.object({
    sms: z.string(),
  }),
  z.object({
    email: z.string().email(),
  }),
  z.object({
    slack: z.string(),
  }),
  z.object({
    discord: z.string(),
  }),
]);
