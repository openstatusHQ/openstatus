import { z } from "zod";

import { Events } from "@openstatus/analytics";
import { NotFoundError } from "@openstatus/services";
import {
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
    .input(
      z.object({
        pageId: z.number(),
        components: z.array(
          z.object({
            id: z.number().optional(),
            monitorId: z.number().nullish(),
            order: z.number(),
            name: z.string(),
            description: z.string().nullish(),
            type: z.enum(["monitor", "static"]),
          }),
        ),
        groups: z.array(
          z.object({
            order: z.number(),
            name: z.string(),
            defaultOpen: z.boolean().optional().default(false),
            components: z.array(
              z.object({
                id: z.number().optional(),
                monitorId: z.number().nullish(),
                order: z.number(),
                name: z.string(),
                description: z.string().nullish(),
                type: z.enum(["monitor", "static"]),
              }),
            ),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await updatePageComponentOrder({
          ctx: toServiceCtx(ctx),
          input: {
            pageId: input.pageId,
            components: input.components,
            groups: input.groups,
          },
        });
        return { success: true };
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
