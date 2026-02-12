import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { channelTypes } from "./constants";
import { pageSubscription } from "./page_subscription";

// Channel type enum schema
export const channelTypeSchema = z.enum(channelTypes);

// Base subscription schemas (auto-generated from Drizzle schema)
export const selectPageSubscriptionSchema =
  createSelectSchema(pageSubscription);
export const insertPageSubscriptionSchema =
  createInsertSchema(pageSubscription);

// Channel config schemas
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

// Discriminated union for type-safe subscriptions
// After parsing, TypeScript knows which identifier field is non-null
export const pageSubscriptionSchema = z.discriminatedUnion("channelType", [
  // Email channel
  z.object({
    id: z.number(),
    pageId: z.number(),
    workspaceId: z.number(),
    channelType: z.literal("email"),
    email: z.string().email(),
    webhookUrl: z.null(),
    channelConfig: z.null(),
    token: z.string(),
    verifiedAt: z.date().nullable(),
    expiresAt: z.date().nullable(),
    unsubscribedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
  // Webhook channel
  z.object({
    id: z.number(),
    pageId: z.number(),
    workspaceId: z.number(),
    channelType: z.literal("webhook"),
    email: z.null(),
    webhookUrl: z.string().url(),
    channelConfig: z
      .string()
      .transform((str) => {
        try {
          return JSON.parse(str);
        } catch {
          return null;
        }
      })
      .pipe(webhookChannelConfigSchema.nullable()),
    token: z.string(),
    verifiedAt: z.date().nullable(),
    expiresAt: z.date().nullable(),
    unsubscribedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
]);

// Insert schemas for API validation
export const insertEmailSubscriptionSchema = z.object({
  pageId: z.number().int().positive(),
  workspaceId: z.number().int().positive(),
  channelType: z.literal("email"),
  email: z.string().email(),
  webhookUrl: z.null().optional(),
  channelConfig: z.null().optional(),
  token: z.string().uuid().optional(), // Generated if not provided
  expiresAt: z.date().optional(),
});

export const insertWebhookSubscriptionSchema = z.object({
  pageId: z.number().int().positive(),
  workspaceId: z.number().int().positive(),
  channelType: z.literal("webhook"),
  email: z.null().optional(),
  webhookUrl: z.string().url(),
  channelConfig: z
    .string()
    .optional()
    .transform((str) => {
      if (!str) return null;
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    })
    .pipe(webhookChannelConfigSchema.nullable()),
  token: z.string().uuid().optional(), // Generated if not provided
  expiresAt: z.date().optional(),
});

// Discriminated union for insert operations
export const insertPageSubscriptionWithChannelSchema = z.discriminatedUnion(
  "channelType",
  [insertEmailSubscriptionSchema, insertWebhookSubscriptionSchema],
);

// Type exports
export type PageSubscription = z.infer<typeof pageSubscriptionSchema>;
export type InsertPageSubscription = z.infer<
  typeof insertPageSubscriptionSchema
>;
export type SelectPageSubscription = z.infer<
  typeof selectPageSubscriptionSchema
>;
export type ChannelType = z.infer<typeof channelTypeSchema>;

export type EmailSubscription = Extract<
  PageSubscription,
  { channelType: "email" }
>;
export type WebhookSubscription = Extract<
  PageSubscription,
  { channelType: "webhook" }
>;

export type InsertEmailSubscription = z.infer<
  typeof insertEmailSubscriptionSchema
>;
export type InsertWebhookSubscription = z.infer<
  typeof insertWebhookSubscriptionSchema
>;
export type InsertPageSubscriptionWithChannel = z.infer<
  typeof insertPageSubscriptionWithChannelSchema
>;
