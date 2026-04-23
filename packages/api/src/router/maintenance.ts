import { Events } from "@openstatus/analytics";
import {
  createMaintenance,
  deleteMaintenance,
  listMaintenances,
  updateMaintenance,
} from "@openstatus/services/maintenance";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { periods } from "./utils";

export const maintenanceRouter = createTRPCRouter({
  delete: protectedProcedure
    .meta({ track: Events.DeleteMaintenance })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteMaintenance({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
        // Preserve the old contract — return an empty array that looks like
        // drizzle's `.returning()` result. Callers today ignore the payload,
        // only `.mutate` success/failure is observed.
        return [] as Array<never>;
      } catch (err) {
        toTRPCError(err);
      }
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          period: z.enum(periods).optional(),
          pageId: z.number().optional(),
          order: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { items } = await listMaintenances({
          ctx: toServiceCtx(ctx),
          input: {
            pageId: input?.pageId,
            period: input?.period,
            order: input?.order ?? "desc",
            // tRPC callers (dashboard) want the full set — see
            // statusReport.list for the same reasoning.
            limit: 10_000,
            offset: 0,
          },
        });
        return items;
      } catch (err) {
        toTRPCError(err);
      }
    }),

  new: protectedProcedure
    .meta({ track: Events.CreateMaintenance })
    .input(
      z.object({
        pageId: z.number(),
        title: z.string(),
        message: z.string(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        pageComponents: z.array(z.number()).optional(),
        notifySubscribers: z.boolean().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const record = await createMaintenance({
          ctx: toServiceCtx(ctx),
          input: {
            title: input.title,
            message: input.message,
            from: input.startDate,
            to: input.endDate,
            pageId: input.pageId,
            pageComponentIds: input.pageComponents ?? [],
          },
        });
        return { ...record, notifySubscribers: input.notifySubscribers };
      } catch (err) {
        toTRPCError(err);
      }
    }),

  update: protectedProcedure
    .meta({ track: Events.UpdateMaintenance })
    .input(
      z.object({
        id: z.number(),
        title: z.string(),
        message: z.string(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        pageComponents: z.array(z.number()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await updateMaintenance({
          ctx: toServiceCtx(ctx),
          input: {
            id: input.id,
            title: input.title,
            message: input.message,
            from: input.startDate,
            to: input.endDate,
            pageComponentIds: input.pageComponents,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
