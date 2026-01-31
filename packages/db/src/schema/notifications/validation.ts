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
      .prefault("{}"),
  },
);

// we need to extend, otherwise data can be `null` or `undefined` - default is not
export const insertNotificationSchema = createInsertSchema(notification).extend(
  {
    data: z.string().prefault("{}"),
    monitors: z.array(z.number()).optional().prefault([]),
  },
);

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = z.infer<typeof selectNotificationSchema>;
export type NotificationProvider = z.infer<typeof notificationProviderSchema>;

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/,
);

export const phoneSchema = z.string().regex(phoneRegex, "Invalid Number!");
export const emailSchema = z.email();
export const urlSchema = z.url();

export const ntfyDataSchema = z.object({
  ntfy: z.object({
    topic: z.string().prefault(""),
    serverUrl: z.string().prefault("https://ntfy.sh"),
    token: z.string().optional(),
  }),
});
export const webhookDataSchema = z.object({
  webhook: z.object({
    endpoint: z.url(),
    headers: z
      .array(z.object({ key: z.string(), value: z.string() }))
      .optional(),
  }),
});
export const emailDataSchema = z.object({ email: emailSchema });
export const phoneDataSchema = z.object({ sms: phoneSchema });
export const slackDataSchema = z.object({ slack: urlSchema });
export const discordDataSchema = z.object({ discord: urlSchema });
export const googleChatDataSchema = z.object({ "google-chat": urlSchema });
export const pagerdutyDataSchema = z.object({ pagerduty: z.string() });
export const opsgenieDataSchema = z.object({
  opsgenie: z.object({
    apiKey: z.string(),
    region: z.enum(["us", "eu"]),
  }),
});
export const telegramDataSchema = z.object({
  telegram: z.object({ chatId: z.string() }),
});

export const grafanaOncallDataSchema = z.object({
  "grafana-oncall": z.object({
    webhookUrl: z.url(),
  }),
});

export const whatsappDataSchema = z.object({
  whatsapp: phoneSchema,
});

export const NotificationDataSchema = z.union([
  discordDataSchema,
  emailDataSchema,
  grafanaOncallDataSchema,
  ntfyDataSchema,
  opsgenieDataSchema,
  pagerdutyDataSchema,
  phoneDataSchema,
  telegramDataSchema,
  slackDataSchema,
  webhookDataSchema,
  whatsappDataSchema,
  googleChatDataSchema,
]);

export const InsertNotificationWithDataSchema = z.discriminatedUnion(
  "provider",
  [
    insertNotificationSchema.extend(
      z.object({
        provider: z.literal("discord"),
        data: discordDataSchema,
      }).shape,
    ),
    insertNotificationSchema.extend(
      z.object({
        provider: z.literal("email"),
        data: emailDataSchema,
      }).shape,
    ),
    insertNotificationSchema.extend(
      z.object({
        provider: z.literal("google-chat"),
        data: googleChatDataSchema,
      }).shape,
    ),
    insertNotificationSchema.extend(
      z.object({
        provider: z.literal("grafana-oncall"),
        data: grafanaOncallDataSchema,
      }).shape,
    ),
    insertNotificationSchema.extend(
      z.object({
        provider: z.literal("ntfy"),
        data: ntfyDataSchema,
      }).shape,
    ),
    insertNotificationSchema.extend(
      z.object({
        provider: z.literal("pagerduty"),
        data: pagerdutyDataSchema,
      }).shape,
    ),
    insertNotificationSchema.extend(
      z.object({
        provider: z.literal("opsgenie"),
        data: opsgenieDataSchema,
      }).shape,
    ),
    insertNotificationSchema.extend(
      z.object({
        provider: z.literal("sms"),
        data: phoneDataSchema,
      }).shape,
    ),
    insertNotificationSchema.extend(
      z.object({
        provider: z.literal("slack"),
        data: slackDataSchema,
      }).shape,
    ),
    insertNotificationSchema.extend(
      z.object({
        provider: z.literal("webhook"),
        data: webhookDataSchema,
      }).shape,
    ),
    insertNotificationSchema.extend(
      z.object({
        provider: z.literal("whatsapp"),
        data: whatsappDataSchema,
      }).shape,
    ),
  ],
);

export type InsertNotificationWithData = z.infer<
  typeof InsertNotificationWithDataSchema
>;
