import { pageComponentImpactSchema } from "@openstatus/db/src/schema/page_components/validation";
import { z } from "zod";

/**
 * Canonical contract for the generic (self-hosted) status-page webhook.
 * Bump WEBHOOK_PAYLOAD_VERSION on any breaking change; the self-hosted
 * `statuspage-socials-notifier` copies these schemas and rejects unknown
 * versions, so the two sides stay decoupled.
 */
export const WEBHOOK_PAYLOAD_VERSION = "1" as const;

const componentSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  impact: pageComponentImpactSchema,
  changed: z.boolean(),
});

const pageSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  url: z.url(),
});

const subscriptionSchema = z.object({
  manage_url: z.string().nullable(),
  unsubscribe_url: z.string().nullable(),
});

export const statusReportWebhookSchema = z.object({
  version: z.literal(WEBHOOK_PAYLOAD_VERSION),
  type: z.literal("status_report"),
  data: z.object({
    status_report: z.object({
      id: z.number().int(),
      title: z.string(),
      update: z.object({
        id: z.number().int(),
        status: z.enum([
          "investigating",
          "identified",
          "monitoring",
          "resolved",
        ]),
        message: z.string(),
        created_at: z.string(),
      }),
      page: pageSchema,
      components: z.array(componentSchema),
    }),
  }),
  subscription: subscriptionSchema,
});

export const maintenanceWebhookSchema = z.object({
  version: z.literal(WEBHOOK_PAYLOAD_VERSION),
  type: z.literal("maintenance"),
  data: z.object({
    maintenance: z.object({
      id: z.number().int(),
      title: z.string(),
      message: z.string(),
      starts_at: z.string().optional(),
      ends_at: z.string().optional(),
      page: pageSchema,
      components: z.array(componentSchema),
    }),
  }),
  subscription: subscriptionSchema,
});

export const webhookPayloadSchema = z.discriminatedUnion("type", [
  statusReportWebhookSchema,
  maintenanceWebhookSchema,
]);

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
