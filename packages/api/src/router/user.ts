import { deleteAccount, getUser } from "@openstatus/services/user";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getUser({
        ctx: toServiceCtx(ctx),
        input: { userId: ctx.user.id },
      });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // `userId` is derived from `ctx.actor` inside the service — no
      // input needed.
      await deleteAccount({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),
});
