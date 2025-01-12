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
    monitors: z.array(z.number()).optional().default([]),
  },
);

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = z.infer<typeof selectNotificationSchema>;
export type NotificationProvider = z.infer<typeof notificationProviderSchema>;

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/,
);

export const phoneSchema = z.string().regex(phoneRegex, "Invalid Number!");
export const emailSchema = z.string().email();
export const urlSchema = z.string().url();

export const webhookDataSchema = z.object({ webhook: urlSchema });
export const emailDataSchema = z.object({ email: emailSchema });
export const phoneDataSchema = z.object({ sms: phoneSchema });
export const slackDataSchema = z.object({ slack: urlSchema });
export const discordDataSchema = z.object({ discord: urlSchema });
export const pagerdutyDataSchema = z.object({ pagerduty: z.string() });
export const opsgenieDataSchema = z.object({
  opsgenie: z.object({
    apiKey: z.string(),
    region: z.enum(["us", "eu"]),
  }),
});

export const NotificationDataSchema = z.union([
  emailDataSchema,
  phoneDataSchema,
  slackDataSchema,
  discordDataSchema,
  pagerdutyDataSchema,
  opsgenieDataSchema,
]);

export const InsertNotificationWithDataSchema = z.discriminatedUnion(
  "provider",
  [
    insertNotificationSchema.merge(
      z.object({
        provider: z.literal("email"),
        data: emailDataSchema,
      }),
    ),
    insertNotificationSchema.merge(
      z.object({
        provider: z.literal("sms"),
        data: phoneDataSchema,
      }),
    ),
    insertNotificationSchema.merge(
      z.object({
        provider: z.literal("slack"),
        data: slackDataSchema,
      }),
    ),
    insertNotificationSchema.merge(
      z.object({
        provider: z.literal("discord"),
        data: discordDataSchema,
      }),
    ),
    insertNotificationSchema.merge(
      z.object({
        provider: z.literal("pagerduty"),
        data: pagerdutyDataSchema,
      }),
    ),
    insertNotificationSchema.merge(
      z.object({
        provider: z.literal("opsgenie"),
        data: opsgenieDataSchema,
      }),
    ),
  ],
);

export type InsertNotificationWithData = z.infer<
  typeof InsertNotificationWithDataSchema
>;
