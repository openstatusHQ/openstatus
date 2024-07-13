import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { workspacePlans, workspaceRole } from "./constants";
import { workspace } from "./workspace";
import {
  monitorPeriodicitySchema,
  monitorRegionSchema,
} from "../monitors/validation";

export const workspacePlanSchema = z.enum(workspacePlans);
export const workspaceRoleSchema = z.enum(workspaceRole);

export const limitsSchema = z.object({
  monitors: z.number(),
  "synthetic-checks": z.number(),
  periodicity: z.array(monitorPeriodicitySchema),
  "multi-region": z.boolean(),
  "max-regions": z.number(),
  "data-retention": z.string(),
  "status-pages": z.number(),
  maintenance: z.boolean(),
  "status-subscribers": z.boolean(),
  "custom-domain": z.boolean(),
  "password-protection": z.boolean(),
  "white-label": z.boolean(),
  notifications: z.boolean(),
  pagerduty: z.boolean(),
  sms: z.boolean(),
  "notification-channels": z.number(),
  members: z.union([z.literal("Unlimited"), z.number()]),
  "audit-log": z.boolean(),
  regions: z.array(monitorRegionSchema),
});

export const selectWorkspaceSchema = createSelectSchema(workspace).extend({
  limits: limitsSchema,
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
export type Limits = z.infer<typeof limitsSchema>;
