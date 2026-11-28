import { Events } from "@openstatus/analytics";
import {
  CreatePlaybookInput,
  DeletePlaybookInput,
  GetPlaybookInput,
  UpdatePlaybookInput,
  createPlaybook,
  deletePlaybook,
  getPlaybook,
  listPlaybooks,
  updatePlaybook,
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
    .input(GetPlaybookInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getPlaybook({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  create: protectedProcedure
    .meta({ track: Events.CreatePlaybook, trackProps: ["slug"] })
    .input(CreatePlaybookInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createPlaybook({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  update: protectedProcedure
    .meta({ track: Events.UpdatePlaybook, trackProps: ["slug"] })
    .input(UpdatePlaybookInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updatePlaybook({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeletePlaybook, trackProps: ["slug"] })
    .input(DeletePlaybookInput)
    .mutation(async ({ ctx, input }) => {
      try {
        await deletePlaybook({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
