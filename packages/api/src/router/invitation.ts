import { z } from "zod";

import { Events } from "@openstatus/analytics";
import {
  CreateInvitationInput,
  acceptInvitation,
  createInvitation,
  deleteInvitation,
  getInvitationByToken,
  listInvitations,
} from "@openstatus/services/invitation";

import { TRPCError } from "@trpc/server";
import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const invitationRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.InviteUser, trackProps: ["email"] })
    .input(CreateInvitationInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createInvitation({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .meta({ track: Events.DeleteInvite })
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteInvitation({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listInvitations({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  get: protectedProcedure
    .input(z.object({ token: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      if (!input.token) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Token is required.",
        });
      }
      if (!ctx.user.email) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access this resource.",
        });
      }
      try {
        return await getInvitationByToken({
          ctx: toServiceCtx(ctx),
          input: { token: input.token, email: ctx.user.email },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  accept: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.email) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access this resource.",
        });
      }
      try {
        return await acceptInvitation({
          ctx: toServiceCtx(ctx),
          input: {
            id: input.id,
            userId: ctx.user.id,
            email: ctx.user.email,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
