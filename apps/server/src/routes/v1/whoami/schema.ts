import { z } from "@hono/zod-openapi";

import { workspacePlans } from "@openstatus/db/src/schema/workspaces/constants";

export const WorkspaceSchema = z
  .object({
    name: z
      .string()
      .optional()
      .openapi({ description: "The current workspace name" }),
    slug: z.string().openapi({ description: "The current workspace slug" }),
    plan: z.enum(workspacePlans).nullable().default("free").openapi({
      description: "The current workspace plan",
    }),
  })
  .openapi("Workspace");

export type WorkspaceSchema = z.infer<typeof WorkspaceSchema>;
