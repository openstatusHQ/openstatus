import { Events } from "@openstatus/analytics";
import {
  PlaybookTypeInput,
  SavePlaybookInput,
  clearPlaybook,
  getPlaybook,
  listPlaybooks,
  savePlaybook,
} from "@openstatus/services/playbook";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const playbookRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listPlaybooks({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  get: protectedProcedure
    .input(PlaybookTypeInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getPlaybook({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  save: protectedProcedure
    .meta({ track: Events.SavePlaybook, trackProps: ["type"] })
    .input(SavePlaybookInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await savePlaybook({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  clear: protectedProcedure
    .meta({ track: Events.ClearPlaybook, trackProps: ["type"] })
    .input(PlaybookTypeInput)
    .mutation(async ({ ctx, input }) => {
      try {
        await clearPlaybook({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
