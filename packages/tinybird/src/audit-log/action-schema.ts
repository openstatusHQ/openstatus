import { z } from "zod";

/**
 * The schema for the monitor.recovered action.
 * It represents the event when a monitor has recovered from a failure.
 */
export const monitorRecoveredSchema = z.object({
  action: z.literal("monitor.recovered"),
  metadata: z.object({
    region: z.string(),
    statusCode: z.number(),
    latency: z.number().optional(),
    cronTimestamp: z.number().optional(),
  }),
});

/**
 * The schema for the monitor.recovered action.
 * It represents the event when a monitor has recovered from a failure.
 */
export const monitorDegradedSchema = z.object({
  action: z.literal("monitor.degraded"),
  metadata: z.object({
    region: z.string(),
    statusCode: z.number(),
    cronTimestamp: z.number().optional(),
    latency: z.number().optional(),
  }),
});

/**
 * The schema for the monitor.failed action.
 * It represents the event when a monitor has failed.
 */
export const monitorFailedSchema = z.object({
  action: z.literal("monitor.failed"),
  metadata: z.object({
    region: z.string(),
    statusCode: z.number().optional(),
    message: z.string().optional(),
    latency: z.number().optional(),
    cronTimestamp: z.number().optional(),
  }),
});

/**
 * The schema for the notification.send action.
 *
 */
export const notificationSentSchema = z.object({
  action: z.literal("notification.sent"),
  metadata: z.object({
    // we could use the notificationProviderSchema for more type safety
    provider: z.string(),
    cronTimestamp: z.number().optional(),
    type: z.enum(["alert", "recovery", "degraded"]).optional(),
  }),
});

export const incidentCreatedSchema = z.object({
  action: z.literal("incident.created"),
  metadata: z.object({
    cronTimestamp: z.number().optional(),
    incidentId: z.number().optional(),
  }),
});

export const incidentResolvedSchema = z.object({
  action: z.literal("incident.resolved"),
  metadata: z.object({
    cronTimestamp: z.number().optional(),
    incidentId: z.number().optional(),
  }),
});
