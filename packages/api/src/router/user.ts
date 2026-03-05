import { and, eq, ne } from "@openstatus/db";
import {
  account,
  session,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";

import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  get: protectedProcedure.query(async (opts) => {
    return await opts.ctx.db
      .select()
      .from(user)
      .where(eq(user.id, opts.ctx.user.id))
      .get();
  }),

  deleteAccount: protectedProcedure.mutation(async (opts) => {
    const userId = opts.ctx.user.id;

    // Check if user owns any workspace with a paid plan
    const ownedWorkspaces = await opts.ctx.db.query.usersToWorkspaces.findMany({
      where: and(
        eq(usersToWorkspaces.userId, userId),
        eq(usersToWorkspaces.role, "owner"),
      ),
      with: {
        workspace: true,
      },
    });

    const hasPaidWorkspace = ownedWorkspaces.some(
      ({ workspace }) => workspace.plan && workspace.plan !== "free",
    );

    if (hasPaidWorkspace) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "You must cancel your subscription before deleting your account.",
      });
    }

    await opts.ctx.db.transaction(async (tx) => {
      // Remove from non-owned workspaces
      await tx
        .delete(usersToWorkspaces)
        .where(
          and(
            eq(usersToWorkspaces.userId, userId),
            ne(usersToWorkspaces.role, "owner"),
          ),
        );

      // Delete sessions
      await tx.delete(session).where(eq(session.userId, userId));

      // Delete OAuth accounts
      await tx.delete(account).where(eq(account.userId, userId));

      // Soft delete user
      await tx
        .update(user)
        .set({ deletedAt: new Date() })
        .where(eq(user.id, userId));
    });
  }),
});
