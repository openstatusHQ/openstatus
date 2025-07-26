import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { Events } from "@openstatus/analytics";
import { type SQL, and, db, eq, gte, isNull } from "@openstatus/db";
import {
  insertInvitationSchema,
  invitation,
  selectWorkspaceSchema,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const invitationRouter = createTRPCRouter({
  create: protectedProcedure
    .input(insertInvitationSchema.pick({ email: true }))
    .meta({ track: Events.InviteUser })
    .mutation(async (opts) => {
      const { email } = opts.input;

      const _members = opts.ctx.workspace.limits.members;
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

      return _invitation;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .meta({ track: Events.DeleteInvite })
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
    .meta({ track: Events.AcceptInvite })
    .output(
      z.object({
        message: z.string(),
        data: selectWorkspaceSchema.optional(),
      }),
    )
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

      if (!opts.ctx.session?.user?.id) return { message: "Missing user." };

      const _user = await opts.ctx.db.query.user.findFirst({
        where: eq(user.id, Number(opts.ctx.session.user.id)),
      });

      if (!_user) return { message: "Invalid user." };

      if (!_invitation) return { message: "Invalid invitation token." };

      if (_invitation.email !== _user.email)
        return { message: "You are not invited to this workspace." };

      if (_invitation.expiresAt.getTime() < new Date().getTime()) {
        return { message: "Invitation expired." };
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

      return {
        message: "Invitation accepted.",
        data: _invitation.workspace,
      };
    }),

  // DASHBOARD

  list: protectedProcedure.query(async (opts) => {
    const whereConditions: SQL[] = [
      eq(invitation.workspaceId, opts.ctx.workspace.id),
      gte(invitation.expiresAt, new Date()),
      isNull(invitation.acceptedAt),
    ];

    const result = await opts.ctx.db.query.invitation.findMany({
      where: and(...whereConditions),
    });

    return result;
  }),

  get: protectedProcedure
    .input(z.object({ token: z.string().nullable() }))
    .query(async (opts) => {
      if (!opts.ctx.user.email) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access this resource.",
        });
      }

      if (!opts.input.token) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Token is required.",
        });
      }

      const result = await opts.ctx.db.query.invitation.findFirst({
        where: and(
          eq(invitation.token, opts.input.token),
          isNull(invitation.acceptedAt),
          gte(invitation.expiresAt, new Date()),
          eq(invitation.email, opts.ctx.user.email),
        ),
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found.",
        });
      }

      return result;
    }),

  accept: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      if (!opts.ctx.user.email) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access this resource.",
        });
      }

      console.log(opts.input);

      const _invitation = await opts.ctx.db.query.invitation.findFirst({
        where: and(
          eq(invitation.id, opts.input.id),
          eq(invitation.email, opts.ctx.user.email),
          isNull(invitation.acceptedAt),
          gte(invitation.expiresAt, new Date()),
        ),
      });

      if (!_invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found.",
        });
      }

      if (_invitation.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation already accepted.",
        });
      }

      const result = await db.transaction(async (tx) => {
        await tx
          .update(invitation)
          .set({
            acceptedAt: new Date(),
          })
          .where(eq(invitation.id, opts.input.id))
          .run();

        await tx
          .insert(usersToWorkspaces)
          .values({
            userId: opts.ctx.user.id,
            workspaceId: _invitation.workspaceId,
            role: _invitation.role,
          })
          .run();

        const _workspace = await tx.query.workspace.findFirst({
          where: eq(workspace.id, _invitation.workspaceId),
        });

        return _workspace;
      });

      return result;
    }),
});
