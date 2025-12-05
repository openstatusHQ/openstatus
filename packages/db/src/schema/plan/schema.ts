import { FREE_FLY_REGIONS } from "@openstatus/regions";
import { z } from "zod";
import { monitorPeriodicitySchema, monitorRegionSchema } from "../constants";

// REMINDER: this is not a database table but just a schema for the limits of the plan
// default values are set to the free plan limits

export const limitsSchema = z.object({
  version: z.undefined(),
  /**
   * Monitor limits
   */
  monitors: z.number().prefault(1),
  "synthetic-checks": z.number().prefault(30), // monthly limits
  periodicity: monitorPeriodicitySchema.array().prefault(["10m", "30m", "1h"]),
  "multi-region": z.boolean().prefault(true),
  "max-regions": z.number().prefault(6),
  "data-retention": z
    .enum(["14 days", "3 months", "12 months", "24 months"])
    .prefault("14 days"),
  regions: monitorRegionSchema.array().prefault(FREE_FLY_REGIONS),
  "private-locations": z.boolean().prefault(false),
  screenshots: z.boolean().prefault(false),
  "response-logs": z.boolean().prefault(false),
  otel: z.boolean().prefault(false),
  /**
   * Status page limits
   */
  "status-pages": z.number().prefault(1),
  maintenance: z.boolean().prefault(true),
  "monitor-values-visibility": z.boolean().prefault(true),
  "status-subscribers": z.boolean().prefault(false),
  "custom-domain": z.boolean().prefault(false),
  "password-protection": z.boolean().prefault(false),
  "white-label": z.boolean().prefault(false),
  /**
   * Notification limits
   */
  notifications: z.boolean().prefault(true),
  pagerduty: z.boolean().prefault(false),
  opsgenie: z.boolean().prefault(false),
  sms: z.boolean().prefault(false),
  "sms-limit": z.number().prefault(0),
  "notification-channels": z.number().prefault(1),
  /**
   * Collaboration limits
   */
  members: z.literal("Unlimited").or(z.number()).prefault(1),
  "audit-log": z.boolean().prefault(false),
});

export type Limits = z.infer<typeof limitsSchema>;
