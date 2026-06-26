import { pageComponentImpactSchema } from "@openstatus/db/src/schema/page_components/validation";
import { statusReportStatusSchema } from "@openstatus/db/src/schema/status_reports/validation";
import { z } from "zod";

/** Bump on any breaking change — external consumers (statuspage-socials-notifier) pin to this version. */
export const WEBHOOK_PAYLOAD_VERSION = "1" as const;

const componentSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  impact: pageComponentImpactSchema,
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
      url: z.url(),
      update: z.object({
        id: z.number().int(),
        status: statusReportStatusSchema,
        message: z.string(),
        occurred_at: z.string(),
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
      url: z.url(),
      message: z.string(),
      starts_at: z.string().optional(),
      ends_at: z.string().optional(),
      page: pageSchema,
      components: z.array(componentSchema),
    }),
  }),
  subscription: subscriptionSchema,
});

export const testWebhookSchema = z.object({
  version: z.literal(WEBHOOK_PAYLOAD_VERSION),
  type: z.literal("test"),
  data: z.object({
    test: z.object({
      message: z.string(),
      timestamp: z.string(),
    }),
  }),
});

export const webhookPayloadSchema = z.discriminatedUnion("type", [
  statusReportWebhookSchema,
  maintenanceWebhookSchema,
  testWebhookSchema,
]);

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
