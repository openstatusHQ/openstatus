import { Events } from "@openstatus/analytics";
import {
  PlaybookSlugInput,
  SavePlaybookInput,
  clearPlaybook,
  createPlaybook,
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
    .input(PlaybookSlugInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getPlaybook({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  create: protectedProcedure
    .meta({ track: Events.SavePlaybook, trackProps: ["slug"] })
    .input(SavePlaybookInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createPlaybook({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  save: protectedProcedure
    .meta({ track: Events.SavePlaybook, trackProps: ["slug"] })
    .input(SavePlaybookInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await savePlaybook({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  clear: protectedProcedure
    .meta({ track: Events.ClearPlaybook, trackProps: ["slug"] })
    .input(PlaybookSlugInput)
    .mutation(async ({ ctx, input }) => {
      try {
        await clearPlaybook({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
