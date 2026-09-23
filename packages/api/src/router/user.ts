import { deleteAccount } from "@openstatus/services/user";

import { removeDomainFromVercelIfUnused } from "../lib/vercel";
import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { cancelOwnedTrials } from "./stripe/trial";

export const userRouter = createTRPCRouter({
  // The authed middleware already loaded this row; re-selecting it would be
  // the same query. `undefined` for a soft-deleted user matches `getUser`.
  get: protectedProcedure.query(({ ctx }) =>
    ctx.user.deletedAt ? undefined : ctx.user,
  ),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // A trial is not a paid plan the user has to cancel first.
      const customDomains = await cancelOwnedTrials({
        userId: ctx.user.id,
        db: ctx.db,
      });
      // `userId` is derived from `ctx.actor` inside the service — no
      // input needed.
      await deleteAccount({ ctx: toServiceCtx(ctx) });
      for (const domain of customDomains) {
        await removeDomainFromVercelIfUnused(ctx.db, domain).catch((error) =>
          console.error("Failed to release domain from Vercel:", {
            domain,
            error,
          }),
        );
      }
    } catch (err) {
      toTRPCError(err);
    }
  }),
});
