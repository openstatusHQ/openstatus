import { z } from "zod";

export const PagerDutySchema = z.object({
  integration_keys: z.array(
    z.object({
      integration_key: z.string(),
      name: z.string(),
      id: z.string(),
      type: z.string(),
    }),
  ),
  account: z.object({ subdomain: z.string(), name: z.string() }),
});

export const actionSchema = z.union([
  z.literal("trigger"),
  z.literal("acknowledge"),
  z.literal("resolve"),
]);

export const severitySchema = z.union([
  z.literal("critical"),
  z.literal("error"),
  z.literal("warning"),
  z.literal("info"),
]);

export const imageSchema = z.object({
  src: z.string(),
  href: z.string().optional(),
  alt: z.string().optional(),
});

export const linkSchema = z.object({
  href: z.string(),
  text: z.string().optional(),
});

const baseEventPayloadSchema = z.object({
  routing_key: z.string(),
  dedup_key: z.string(),
});

export const triggerEventPayloadSchema = baseEventPayloadSchema.merge(
  z.object({
    event_action: z.literal("trigger"),
    payload: z.object({
      summary: z.string(),
      source: z.string(),
      severity: severitySchema,
      timestamp: z.string().optional(),
      component: z.string().optional(),
      group: z.string().optional(),
      class: z.string().optional(),
      custom_details: z.any().optional(),
    }),
    images: z.array(imageSchema).optional(),
    links: z.array(linkSchema).optional(),
  }),
);

export const acknowledgeEventPayloadSchema = baseEventPayloadSchema.merge(
  z.object({
    event_action: z.literal("acknowledge"),
  }),
);

export const resolveEventPayloadSchema = baseEventPayloadSchema.merge(
  z.object({
    event_action: z.literal("resolve"),
  }),
);

export const eventPayloadV2Schema = z.discriminatedUnion("event_action", [
  triggerEventPayloadSchema,
  acknowledgeEventPayloadSchema,
  resolveEventPayloadSchema,
]);
