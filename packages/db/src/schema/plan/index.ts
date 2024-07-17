import { z } from "zod";
import { monitorFlyRegionSchema, monitorPeriodicitySchema } from "../shared";

// This is not a database table but just a schema for the limits of the plan

export const limitsV1 = z.object({
  version: z.undefined(),
  monitors: z.number(),
  "synthetic-checks": z.number(),
  periodicity: monitorPeriodicitySchema.array(),
  "multi-region": z.boolean(),
  "max-regions": z.number(),
  "data-retention": z.enum(["14 days", "3 months", "12 months", "24 months"]),
  // status pages
  "status-pages": z.number(),
  maintenance: z.boolean(),
  "status-subscribers": z.boolean(),
  "custom-domain": z.boolean(),
  "password-protection": z.boolean(),
  "white-label": z.boolean(),
  // alerts
  notifications: z.boolean(),
  pagerduty: z.boolean(),
  sms: z.boolean(),
  "notification-channels": z.number(),
  // collaboration
  members: z.literal("Unlimited").or(z.number()),
  "audit-log": z.boolean(),
  regions: monitorFlyRegionSchema.array(),
});

const unknownLimit = z.discriminatedUnion("version", [limitsV1]);

// export const limitSchema = unknownLimit.transform((val) => {
//   if (!val.version) {
//     return migrateFromV1ToV2(val);
//   }
//   return val;
// });

export type Limits = z.infer<typeof unknownLimit>;
