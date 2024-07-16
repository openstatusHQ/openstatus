import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { workspacePlans, workspaceRole } from "./constants";
import { workspace } from "./workspace";
import {
  monitorFlyRegionSchema,
  monitorPeriodicitySchema,
} from "../shared/shared";

export const workspacePlanSchema = z.enum(workspacePlans);
export const workspaceRoleSchema = z.enum(workspaceRole);

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

export const selectWorkspaceSchema = createSelectSchema(workspace).extend({
  limits: z.string().transform((val) => {
    const parsed = JSON.parse(val);
    const result = limitsV1.safeParse(parsed);
    if (result.error) {
      // Fallback to default limits
      return limitsV1.parse({
        monitors: 1,
        "synthetic-checks": 1000,
        periodicity: ["10m", "30m", "1h"],
        "multi-region": true,
        "max-regions": 6,
        "data-retention": "14 days",
        "status-pages": 1,
        maintenance: true,
        "status-subscribers": false,
        "custom-domain": false,
        "password-protection": false,
        "white-label": false,
        notifications: true,
        sms: false,
        pagerduty: false,
        "notification-channels": 1,
        members: 1,
        "audit-log": false,
        regions: ["ams", "gru", "iad", "jnb", "hkg", "syd"],
      });
    }
    return result.data;
  }),
  plan: z
    .enum(workspacePlans)
    .nullable()
    .default("free")
    .transform((val) => val ?? "free"),
});

export const insertWorkspaceSchema = createSelectSchema(workspace);

export type Workspace = z.infer<typeof selectWorkspaceSchema>;
export type WorkspacePlan = z.infer<typeof workspacePlanSchema>;
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type Limits = z.infer<typeof limitsV1>;
