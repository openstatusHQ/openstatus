import { Events } from "@openstatus/analytics";
import {
  ListMembersInput,
  deleteMember,
  listMembers,
} from "@openstatus/services/member";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const memberRouter = createTRPCRouter({
  list: protectedProcedure
    .input(ListMembersInput.optional())
    .query(async ({ ctx, input }) => {
      try {
        return await listMembers({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.RemoveUser })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteMember({
          ctx: toServiceCtx(ctx),
          input: { userId: input.id },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
