import { eq } from "@openstatus/db";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { user } from "@openstatus/db/src/schema";

export const workspaceRouter = createTRPCRouter({
  getUserWorkspace: protectedProcedure.query(async (opts) => {
    return await opts.ctx.db.query.workspace.findMany({
      with: { user: { where: eq(user.tenantId, opts.ctx.auth.userId) } },
    });
  }),
});
