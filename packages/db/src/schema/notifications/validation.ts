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
    monitors: z.array(z.number()).optional().default([]),
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

export const emailDataSchema = z.object({ email: emailSchema });
export const phoneDataSchema = z.object({ sms: phoneSchema });
export const slackDataSchema = z.object({ slack: urlSchema });
export const discordDataSchema = z.object({ discord: urlSchema });
export const pagerdutyDataSchema = z.object({ pagerduty: z.string() });

export const NotificationDataSchema = z.union([
  emailDataSchema,
  phoneDataSchema,
  slackDataSchema,
  discordDataSchema,
  pagerdutyDataSchema,
]);
