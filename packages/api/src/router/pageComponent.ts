import { z } from "zod";

import { Events } from "@openstatus/analytics";
import { NotFoundError } from "@openstatus/services";
import {
  UpdatePageComponentOrderInput,
  deletePageComponent,
  listPageComponents,
  updatePageComponentOrder,
} from "@openstatus/services/page-component";

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

  delete: protectedProcedure
    .meta({ track: Events.DeletePageComponent, trackProps: ["id"] })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deletePageComponent({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
        // Old contract returned drizzle `.returning()` — callers today
        // ignore the payload, only `.mutate` success/failure matters.
        return [] as Array<never>;
      } catch (err) {
        // Preserve the pre-migration idempotent behaviour — the old tRPC
        // delete silently succeeded when the row was already gone.
        if (err instanceof NotFoundError) return [] as Array<never>;
        toTRPCError(err);
      }
    }),

  updateOrder: protectedProcedure
    .meta({ track: Events.UpdatePageComponentOrder, trackProps: ["pageId"] })
    // Reuse the service's canonical input schema directly — the local
    // flat `z.object` that lived here previously let components slip
    // through with `type: "monitor"` but no `monitorId`, which the
    // service (now a discriminated union) rejects. Sharing the schema
    // keeps the two layers in lockstep so dashboard build + service
    // validation enforce the same shape.
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
