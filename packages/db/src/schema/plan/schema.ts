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
  "page-components": z.number().prefault(3),
  maintenance: z.boolean().prefault(true),
  "monitor-values-visibility": z.boolean().prefault(true),
  "status-subscribers": z.boolean().prefault(false),
  "custom-domain": z.boolean().prefault(false),
  "password-protection": z.boolean().prefault(false),
  "email-domain-protection": z.boolean().prefault(false), // add-on but required in limits
  "white-label": z.boolean().prefault(false),
  /**
   * Notification limits
   */

  notifications: z.boolean().prefault(true),
  pagerduty: z.boolean().prefault(false),
  opsgenie: z.boolean().prefault(false),
  "grafana-oncall": z.boolean().prefault(false),
  whatsapp: z.boolean().prefault(false),
  sms: z.boolean().prefault(false),
  "sms-limit": z.number().prefault(0),
  "notification-channels": z.number().prefault(1),

  /**
   * Collaboration limits
   */
  members: z.literal("Unlimited").or(z.number()).prefault(1),
  "audit-log": z.boolean().prefault(false),

  /**
   * Other limits
   */
  "slack-agent": z.boolean().prefault(false),
});

export type Limits = z.infer<typeof limitsSchema>;

//

const priceSchema = z.object({
  USD: z.number(),
  EUR: z.number(),
  INR: z.number(),
});

export type Price = z.infer<typeof priceSchema>;

export const addons = [
  "email-domain-protection",
  "white-label",
  "status-pages",
] as const satisfies Partial<keyof Limits>[];

export const addonsSchema = z.partialRecord(
  z.enum(addons),
  z.object({
    price: priceSchema,
  }),
) satisfies z.ZodType<Partial<Record<keyof Limits, { price: Price }>>>;

export type Addons = z.infer<typeof addonsSchema>;

/**
 * Enforces that addon keys in Limits must be set to false in plan configs
 * (since addons can only be enabled by purchasing them)
 */
export type PlanLimits = {
  [K in keyof Limits]: K extends keyof Addons
    ? Limits[K] extends boolean
      ? false // Force addon boolean fields to false
      : Limits[K] // Non-boolean fields stay as-is
    : Limits[K]; // Non-addon fields stay as-is
};
