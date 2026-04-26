import {
  ListPrivateLocationsInput,
  createPrivateLocation,
  deletePrivateLocation,
  listPrivateLocations,
  updatePrivateLocation,
} from "@openstatus/services/private-location";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const privateLocationRouter = createTRPCRouter({
  list: protectedProcedure
    .input(ListPrivateLocationsInput.optional())
    .query(async ({ ctx, input }) => {
      try {
        return await listPrivateLocations({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  new: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        monitors: z.array(z.number()),
        token: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createPrivateLocation({
          ctx: toServiceCtx(ctx),
          input: {
            name: input.name,
            token: input.token,
            monitors: input.monitors,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string(),
        monitors: z.array(z.number()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updatePrivateLocation({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deletePrivateLocation({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
