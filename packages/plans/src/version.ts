import {
  monitorFlyRegionSchema,
  monitorPeriodicitySchema,
} from "@openstatus/db/src/schema";
import { z } from "zod";

const limitsV1 = z.object({
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

const limitsV2 = limitsV1.extend({
  version: z.literal("2"),
  // newField: z.boolean(),
});

const migrateFromV1ToV2 = (
  v1: z.infer<typeof limitsV1>,
): z.infer<typeof limitsV2> => {
  return {
    ...v1,
    version: "2",
  };
};

const unknownLimit = z.discriminatedUnion("version", [limitsV1, limitsV2]);

export const limitSchema = unknownLimit.transform((val) => {
  if (!val.version) {
    return migrateFromV1ToV2(val);
  }
  return val;
});

export type Limits = z.infer<typeof unknownLimit>;
