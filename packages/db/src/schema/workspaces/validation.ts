import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { workspacePlans } from "./constants";
import { workspace } from "./workspace";

export const workspacePlanSchema = z.enum(workspacePlans);

export const selectWorkspaceSchema = createSelectSchema(workspace).extend({
  plan: z
    .enum(workspacePlans)
    .nullable()
    .default("free")
    .transform((val) => val ?? "free"),
});

export const insertWorkspaceSchema = createSelectSchema(workspace);

export type Workspace = z.infer<typeof selectWorkspaceSchema>;
export type WorkspacePlan = z.infer<typeof workspacePlanSchema>;
