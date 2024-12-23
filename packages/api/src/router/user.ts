import { eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  getCurrentUser: protectedProcedure.query(async (opts) => {
    const currentUser = await opts.ctx.db
      .select()
      .from(user)
      .where(eq(user.id, opts.ctx.user.id))
      .get();
    return currentUser;
  }),
});
