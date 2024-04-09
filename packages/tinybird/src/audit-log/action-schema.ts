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
    cronTimestamp: z.number().optional(),
  }),
});

/**
 * The schema for the notification.send action.
 *
 */
export const notificationSentSchema = z.object({
  action: z.literal("notification.sent"),
  // we could use the notificationProviderSchema for more type safety
  metadata: z.object({ provider: z.string() }),
});

// TODO: update schemas with correct metadata and description

export const incidentCreatedSchema = z.object({
  action: z.literal("incident.created"),
  metadata: z.object({}), // tbd
});

export const incidentResolvedSchema = z.object({
  action: z.literal("incident.resolved"),
  metadata: z.object({}), // tbd
});

// ...
