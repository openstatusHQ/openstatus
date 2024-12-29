import { z } from "@hono/zod-openapi";

import { workspacePlans } from "@openstatus/db/src/schema/workspaces/constants";

export const WorkspaceSchema = z.object({
  name: z
    .string()
    .openapi({ description: "The current workspace name" })
    .optional(),
  slug: z.string().openapi({ description: "The current workspace slug" }),
  plan: z
    .enum(workspacePlans)
    .nullable()
    .default("free")
    .transform((val) => val ?? "free")
    .openapi({
      description: "The current workspace plan",
    }),
});

export type WorkspaceSchema = z.infer<typeof WorkspaceSchema>;
