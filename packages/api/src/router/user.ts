import { deleteAccount } from "@openstatus/services/user";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  // The authed middleware already loaded this row; re-selecting it would be
  // the same query. `undefined` for a soft-deleted user matches `getUser`.
  get: protectedProcedure.query(({ ctx }) =>
    ctx.user.deletedAt ? undefined : ctx.user,
  ),

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
