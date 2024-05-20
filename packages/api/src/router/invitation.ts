import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, gte, isNull } from "@openstatus/db";
import {
  insertInvitationSchema,
  invitation,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/plans";

import { trackNewInvitation } from "../analytics";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const invitationRouter = createTRPCRouter({
  create: protectedProcedure
    .input(insertInvitationSchema.pick({ email: true }))
    .mutation(async (opts) => {
      const { email } = opts.input;

      const _members = allPlans[opts.ctx.workspace.plan].limits.members;
      const membersLimit = _members === "Unlimited" ? 420 : _members;

      const usersToWorkspacesNumbers = (
        await opts.ctx.db.query.usersToWorkspaces.findMany({
          where: eq(usersToWorkspaces.workspaceId, opts.ctx.workspace.id),
        })
      ).length;

      const openInvitationsNumbers = (
        await opts.ctx.db.query.invitation.findMany({
          where: and(
            eq(invitation.workspaceId, opts.ctx.workspace.id),
            gte(invitation.expiresAt, new Date()),
            isNull(invitation.acceptedAt),
          ),
        })
      ).length;

      // the user has reached the limits
      if (usersToWorkspacesNumbers + openInvitationsNumbers >= membersLimit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your member limits.",
        });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const token = crypto.randomUUID();

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          to: email,
          from: "Maximilian Kaske <max@openstatus.dev>",
          subject: `You have been invited to join OpenStatus.dev`,
          html: `<p>Click here to join the workspace: <a href='https://openstatus.dev/app/invite?token=${token}'>accept invitation</a></p>`,
        }),
      });

      const _invitation = await opts.ctx.db
        .insert(invitation)
        .values({ email, expiresAt, token, workspaceId: opts.ctx.workspace.id })
        .returning()
        .get();

      if (process.env.NODE_ENV === "development") {
        console.log(
          `>>>> Invitation token: http://localhost:3000/app/invite?token=${token} <<<< `,
        );
      }
      // TODO:
      await trackNewInvitation();

      return _invitation;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      await opts.ctx.db
        .delete(invitation)
        .where(
          and(
            eq(invitation.id, opts.input.id),
            eq(invitation.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .run();
    }),

  getWorkspaceOpenInvitations: protectedProcedure.query(async (opts) => {
    const _invitations = await opts.ctx.db.query.invitation.findMany({
      where: and(
        eq(invitation.workspaceId, opts.ctx.workspace.id),
        gte(invitation.expiresAt, new Date()),
        isNull(invitation.acceptedAt),
      ),
    });
    return _invitations;
  }),

  getInvitationByToken: protectedProcedure
    .input(z.object({ token: z.string() }))
    .query(async (opts) => {
      const _invitation = await opts.ctx.db.query.invitation.findFirst({
        where: and(eq(invitation.token, opts.input.token)),
        with: {
          workspace: true,
        },
      });
      return _invitation;
    }),

  /**
   * REMINDER: we are not using a protected procedure here of the `/app/invite` url
   * instead of `/app/workspace-slug/invite` as the user is not allowed to it yet.
   * We validate the auth token in the `acceptInvitation` procedure
   */
  acceptInvitation: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async (opts) => {
      const _invitation = await opts.ctx.db.query.invitation.findFirst({
        where: and(
          eq(invitation.token, opts.input.token),
          isNull(invitation.acceptedAt),
        ),
        with: {
          workspace: true,
        },
      });

      if (!opts.ctx.session?.user?.id) return "Missing user";

      const _user = await opts.ctx.db.query.user.findFirst({
        where: eq(user.id, Number(opts.ctx.session.user.id)),
      });

      if (!_user) return "Invalid user";

      if (!_invitation) return "Invalid invitation token";

      if (_invitation.email !== _user.email)
        return "You are not invited to this workspace";

      if (_invitation.expiresAt.getTime() < new Date().getTime()) {
        return "Invitation expired";
      }

      await opts.ctx.db
        .update(invitation)
        .set({ acceptedAt: new Date() })
        .where(eq(invitation.id, _invitation.id))
        .run();

      await opts.ctx.db
        .insert(usersToWorkspaces)
        .values({
          userId: _user.id,
          workspaceId: _invitation.workspaceId,
          role: _invitation.role,
        })
        .run();

      return "Invitation accepted";
    }),
});
