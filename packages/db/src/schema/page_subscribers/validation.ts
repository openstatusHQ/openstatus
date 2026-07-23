import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { pageSubscriber } from "./page_subscribers";

// Base schemas (auto-generated from Drizzle schema)
export const selectPageSubscriberSchema = createSelectSchema(pageSubscriber);
export const insertPageSubscriberSchema = createInsertSchema(pageSubscriber, {
  email: z.email().nullable(),
});

// Channel config schema for webhook
export const webhookChannelConfigSchema = z.object({
  headers: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.string(),
      }),
    )
    .optional(),
  secret: z.string().optional(),
});

// Channel config schema for slack. The bot token is resolved from the
// integration row by teamId at send time, never stored here.
export const slackChannelConfigSchema = z.object({
  teamId: z.string().min(1),
  channelId: z.string().min(1),
  channelName: z.string().optional(),
});
export type SlackChannelConfig = z.infer<typeof slackChannelConfigSchema>;

export const subscriberSourceSchema = z
  .enum(["self_signup", "vendor", "import"])
  .default("self_signup");

// Discriminated union for type-safe subscribers
export const pageSubscriberSchema = z.discriminatedUnion("channelType", [
  // Email channel
  z.object({
    id: z.number(),
    pageId: z.number(),
    channelType: z.literal("email"),
    email: z.email(),
    webhookUrl: z.null(),
    channelConfig: z.null(),
    source: subscriberSourceSchema,
    name: z.string().nullable(),
    token: z.string().nullable(),
    acceptedAt: z.date().nullable(),
    expiresAt: z.date().nullable(),
    unsubscribedAt: z.date().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
  }),
  // Webhook channel
  z.object({
    id: z.number(),
    pageId: z.number(),
    channelType: z.literal("webhook"),
    email: z.null(),
    webhookUrl: z.string().url(),
    channelConfig: z
      .string()
      .nullable()
      .transform((str) => {
        if (!str) return null;
        try {
          return JSON.parse(str);
        } catch {
          return null;
        }
      })
      .pipe(webhookChannelConfigSchema.nullable()),
    source: subscriberSourceSchema,
    name: z.string().nullable(),
    token: z.string().nullable(),
    acceptedAt: z.date().nullable(),
    expiresAt: z.date().nullable(),
    unsubscribedAt: z.date().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
  }),
  // Slack channel
  z.object({
    id: z.number(),
    pageId: z.number(),
    channelType: z.literal("slack"),
    email: z.null(),
    webhookUrl: z.null(),
    slackChannelId: z.string(),
    channelConfig: z
      .string()
      .nullable()
      .transform((str) => {
        if (!str) return null;
        try {
          return JSON.parse(str);
        } catch {
          return null;
        }
      })
      .pipe(slackChannelConfigSchema.nullable()),
    source: subscriberSourceSchema,
    name: z.string().nullable(),
    token: z.string().nullable(),
    acceptedAt: z.date().nullable(),
    expiresAt: z.date().nullable(),
    unsubscribedAt: z.date().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
  }),
]);

export type InsertPageSubscriber = z.infer<typeof insertPageSubscriberSchema>;
export type PageSubscriber = z.infer<typeof selectPageSubscriberSchema>;
export type ChannelType = "email" | "webhook" | "slack";
export type SubscriberSource = z.infer<typeof subscriberSourceSchema>;
export type EmailSubscriber = Extract<
  z.infer<typeof pageSubscriberSchema>,
  { channelType: "email" }
>;
export type WebhookSubscriber = Extract<
  z.infer<typeof pageSubscriberSchema>,
  { channelType: "webhook" }
>;
export type SlackSubscriber = Extract<
  z.infer<typeof pageSubscriberSchema>,
  { channelType: "slack" }
>;
