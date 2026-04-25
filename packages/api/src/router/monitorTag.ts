import {
  listMonitorTags,
  syncMonitorTags,
} from "@openstatus/services/monitor-tag";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const tagSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  color: z.string(),
});

export const monitorTagRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listMonitorTags({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  syncTags: protectedProcedure
    .input(z.array(tagSchema))
    .mutation(async ({ ctx, input }) => {
      try {
        return await syncMonitorTags({
          ctx: toServiceCtx(ctx),
          input: { tags: input },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
