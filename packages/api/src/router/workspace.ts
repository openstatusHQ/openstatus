import { eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const workspaceRouter = createTRPCRouter({
  getUserWorkspace: protectedProcedure.query(async (opts) => {
    return await opts.ctx.db.query.workspace.findMany({
      with: { user: { where: eq(user.tenantId, opts.ctx.auth.userId) } },
    });
  }),
});
