import { eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  get: protectedProcedure.query(async (opts) => {
    return await opts.ctx.db
      .select()
      .from(user)
      .where(eq(user.id, opts.ctx.user.id))
      .get();
  }),
});
