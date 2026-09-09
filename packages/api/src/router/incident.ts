import { Events } from "@openstatus/analytics";
import {
  incidentOriginSchema,
  incidentSeveritySchema,
  incidentStatusSchema,
} from "@openstatus/db/src/schema";
import { NotFoundError } from "@openstatus/services";
import {
  acknowledgeIncident,
  createIncident,
  deleteIncident,
  getIncident,
  listIncidents,
  promoteIncident,
  resolveIncident,
  updateIncident,
} from "@openstatus/services/incident";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const incidentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          status: incidentStatusSchema.optional(),
          origin: incidentOriginSchema.optional(),
          order: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { items } = await listIncidents({
          ctx: toServiceCtx(ctx),
          input: {
            status: input?.status,
            origin: input?.origin,
            order: input?.order ?? "desc",
            limit: 10_000,
          },
        });
        return items;
      } catch (err) {
        toTRPCError(err);
      }
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getIncident({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  create: protectedProcedure
    .meta({ track: Events.CreateIncident })
    .input(
      z.object({
        title: z.string().trim().min(1).max(256),
        summary: z.string().default(""),
        severity: incidentSeveritySchema.default("warning"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createIncident({
          ctx: toServiceCtx(ctx),
          input: { ...input, origin: "manual" },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  update: protectedProcedure
    .meta({ track: Events.UpdateIncident })
    .input(
      z.object({
        id: z.number(),
        title: z.string().trim().min(1).max(256).optional(),
        summary: z.string().optional(),
        status: incidentStatusSchema.optional(),
        severity: incidentSeveritySchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateIncident({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  acknowledge: protectedProcedure
    .meta({ track: Events.AcknowledgeIncident })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await acknowledgeIncident({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  resolve: protectedProcedure
    .meta({ track: Events.ResolveIncident })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await resolveIncident({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  promote: protectedProcedure
    .meta({ track: Events.PromoteIncident })
    .input(
      z.object({
        id: z.number(),
        pageId: z.number(),
        pageComponentIds: z.array(z.number()).default([]),
        message: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await promoteIncident({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteIncident })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteIncident({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        // Same idempotent posture as the monitor-incident router.
        if (err instanceof NotFoundError) return;
        toTRPCError(err);
      }
    }),
});
