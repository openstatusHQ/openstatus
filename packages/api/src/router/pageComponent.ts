import { Events } from "@openstatus/analytics";
import {
  UpdatePageComponentOrderInput,
  listPageComponents,
  updatePageComponentOrder,
} from "@openstatus/services/page-component";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const pageComponentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          pageId: z.number().optional(),
          order: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listPageComponents({
          ctx: toServiceCtx(ctx),
          input: {
            pageId: input?.pageId,
            order: input?.order ?? "asc",
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateOrder: protectedProcedure
    .meta({ track: Events.UpdatePageComponentOrder, trackProps: ["pageId"] })
    // Reuse the service's canonical input schema directly — the local
    // flat `z.object` that lived here previously let components slip
    // through with `type: "monitor"` but no `monitorId`. The service
    // schema carries a `.refine` enforcing that invariant, so sharing
    // it keeps router validation in lockstep with the service.
    .input(UpdatePageComponentOrderInput)
    .mutation(async ({ ctx, input }) => {
      try {
        await updatePageComponentOrder({
          ctx: toServiceCtx(ctx),
          input,
        });
        return { success: true };
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
