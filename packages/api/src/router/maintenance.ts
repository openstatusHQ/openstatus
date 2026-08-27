import { Events } from "@openstatus/analytics";
import { NotFoundError } from "@openstatus/services";
import {
  addMaintenanceUpdate,
  createMaintenance,
  deleteMaintenance,
  deleteMaintenanceUpdate,
  getMaintenance,
  listMaintenances,
  updateMaintenance,
  updateMaintenanceUpdate,
} from "@openstatus/services/maintenance";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { periods } from "./utils";

export const maintenanceRouter = createTRPCRouter({
  createUpdate: protectedProcedure
    .meta({ track: Events.CreateMaintenanceUpdate })
    .input(
      z.object({
        maintenanceId: z.number(),
        message: z.string(),
        date: z.coerce.date().optional(),
        notifySubscribers: z.boolean().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { maintenanceUpdate } = await addMaintenanceUpdate({
          ctx: toServiceCtx(ctx),
          input: {
            maintenanceId: input.maintenanceId,
            message: input.message,
            date: input.date,
          },
        });
        return {
          ...maintenanceUpdate,
          notifySubscribers: input.notifySubscribers,
        };
      } catch (err) {
        toTRPCError(err);
      }
    }),

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
        // Preserve the pre-migration idempotent behaviour — the old tRPC
        // delete silently succeeded when the row was already gone. Connect
        // still returns 404 on missing; external API semantics preserved.
        if (err instanceof NotFoundError) return [] as Array<never>;
        toTRPCError(err);
      }
    }),

  deleteUpdate: protectedProcedure
    .meta({ track: Events.DeleteMaintenanceUpdate })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteMaintenanceUpdate({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getMaintenance({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
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
        const result = await createMaintenance({
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
        return {
          ...result.maintenance,
          initialUpdateId: result.initialUpdate.id,
          notifySubscribers: input.notifySubscribers,
        };
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

  updateUpdate: protectedProcedure
    .meta({ track: Events.UpdateMaintenanceUpdate })
    .input(
      z
        .object({
          id: z.number(),
          message: z.string().min(1).optional(),
          date: z.coerce.date().optional(),
        })
        .refine(
          (input) => input.message !== undefined || input.date !== undefined,
          { message: "At least one field must be provided." },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateMaintenanceUpdate({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
