import { Events } from "@openstatus/analytics";
import { deleteMember, listMembers } from "@openstatus/services/member";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const memberRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listMembers({ ctx: toServiceCtx(ctx) });
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
