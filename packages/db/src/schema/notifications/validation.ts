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
  }
);

// we need to extend, otherwise data can be `null` or `undefined` - default is not
export const insertNotificationSchema = createInsertSchema(notification).extend(
  {
    data: z.string().default("{}"),
  }
);

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = z.infer<typeof selectNotificationSchema>;
export type NotificationProvider = z.infer<typeof notificationProviderSchema>;

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

export const phoneSchema = z.string().regex(phoneRegex, "Invalid Number!");
export const emailSchema = z.string().email();
export const urlSchema = z.string().url();

export const NotificationDataSchema = z.union([
  z.object({ sms: phoneSchema }),
  z.object({ email: emailSchema }),
  z.object({ slack: urlSchema }),
  z.object({ discord: urlSchema }),
  z.object({
    pagerduty: z.string(),
  }),
]);
