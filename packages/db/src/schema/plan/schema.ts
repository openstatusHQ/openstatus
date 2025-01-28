import { z } from "zod";
import { monitorFlyRegionSchema, monitorPeriodicitySchema } from "../constants";

// REMINDER: this is not a database table but just a schema for the limits of the plan
// default values are set to the free plan limits

export const limitsSchema = z.object({
  version: z.undefined(),
  /**
   * Monitor limits
   */
  monitors: z.number().default(1),
  "synthetic-checks": z.number().default(30), // monthly limits
  periodicity: monitorPeriodicitySchema.array().default(["10m", "30m", "1h"]),
  "multi-region": z.boolean().default(true),
  "max-regions": z.number().default(6),
  "data-retention": z
    .enum(["14 days", "3 months", "12 months", "24 months"])
    .default("14 days"),
  regions: monitorFlyRegionSchema
    .array()
    .default(["ams", "gru", "iad", "jnb", "hkg", "syd"]),
  "private-locations": z.boolean().default(false),
  screenshots: z.boolean().default(false),
  otel: z.boolean().default(false),
  /**
   * Status page limits
   */
  "status-pages": z.number().default(1),
  maintenance: z.boolean().default(true),
  "monitor-values-visibility": z.boolean().default(true),
  "status-subscribers": z.boolean().default(false),
  "custom-domain": z.boolean().default(false),
  "password-protection": z.boolean().default(false),
  "white-label": z.boolean().default(false),
  /**
   * Notification limits
   */
  notifications: z.boolean().default(true),
  pagerduty: z.boolean().default(false),
  opsgenie: z.boolean().default(false),
  sms: z.boolean().default(false),
  "notification-channels": z.number().default(1),
  /**
   * Collaboration limits
   */
  members: z.literal("Unlimited").or(z.number()).default(1),
  "audit-log": z.boolean().default(false),
});

export type Limits = z.infer<typeof limitsSchema>;
