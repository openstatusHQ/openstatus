import {
  DeleteChatSessionInput,
  GetChatSessionInput,
  deleteChatSession,
  getChatSession,
  listChatSessions,
} from "@openstatus/services/chat-session";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const chatSessionRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listChatSessions({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  get: protectedProcedure
    .input(GetChatSessionInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getChatSession({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .input(DeleteChatSessionInput)
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteChatSession({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
