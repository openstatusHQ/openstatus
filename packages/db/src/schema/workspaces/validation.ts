import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { allPlans } from "../plan/config";
import { limitsSchema } from "../plan/schema";
import { workspacePlans, workspaceRole } from "./constants";
import { workspace } from "./workspace";

export const workspacePlanSchema = z.enum(workspacePlans);
export const workspaceRoleSchema = z.enum(workspaceRole);

/**
 * Workspace schema with limits and plan
 */
export const selectWorkspaceSchema = createSelectSchema(workspace)
  .extend({
    limits: z.string().transform((val) => {
      const parsed = JSON.parse(val);
      const result = limitsSchema.partial().safeParse(parsed);
      if (result.error) return {};
      return result.data;
    }),
    plan: z
      .enum(workspacePlans)
      .nullable()
      .default("free")
      .transform((val) => val ?? "free"),
  })
  .transform((val) => {
    return {
      ...val,
      limits: limitsSchema.parse({
        ...allPlans[val.plan].limits,
        /**
         * override the default plan limits
         * allows us to set custom limits for a workspace
         */
        ...val.limits,
      }),
    };
  });

export const insertWorkspaceSchema = createSelectSchema(workspace);

export type Workspace = z.infer<typeof selectWorkspaceSchema>;
export type WorkspacePlan = z.infer<typeof workspacePlanSchema>;
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
