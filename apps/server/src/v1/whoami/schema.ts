import { z } from "@hono/zod-openapi";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import { limitSchema } from "@openstatus/db/src/schema/plan/schema";
import { workspacePlans } from "@openstatus/db/src/schema/workspaces/constants";

export const schema = z.object({
  workspaceId: z.number().openapi({
    description: "The current workspace id",
  }),
  plan: z
    .enum(workspacePlans)
    .nullable()
    .default("free")
    .transform((val) => val ?? "free")
    .openapi({
      description: "The current workspace plan",
    }),
});
