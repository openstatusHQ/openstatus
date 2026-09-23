import { PreconditionFailedError } from "@openstatus/services";
import { deleteAccount } from "@openstatus/services/user";
import { listOwnedWorkspaces } from "@openstatus/services/workspace";

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
      // A trial is not a paid plan the user has to cancel first — but a paid
      // workspace elsewhere aborts the delete, so check before touching any
      // trial or the user loses it for nothing. The trial itself must go
      // before `deleteAccount`, which refuses any non-free plan; it is not
      // rolled back if the delete fails, the user simply retries.
      const owned = await listOwnedWorkspaces({
        input: { userId: ctx.user.id },
        db: ctx.db,
      });
      if (owned.some((ws) => ws.plan !== "free" && !ws.trialEndsAt)) {
        throw new PreconditionFailedError(
          "You must cancel your subscription before deleting your account.",
        );
      }
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
