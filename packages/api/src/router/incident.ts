import { Events } from "@openstatus/analytics";
import { NotFoundError } from "@openstatus/services";
import {
  acknowledgeIncident,
  deleteIncident,
  listIncidents,
  resolveIncident,
} from "@openstatus/services/incident";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { periods } from "./utils";

export const incidentRouter = createTRPCRouter({
  delete: protectedProcedure
    .meta({ track: Events.DeleteIncident })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteIncident({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
      } catch (err) {
        // Preserve the pre-migration idempotent behaviour — the old tRPC
        // delete silently returned when the row was already gone.
        if (err instanceof NotFoundError) return;
        toTRPCError(err);
      }
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          period: z.enum(periods).optional(),
          monitorId: z.number().nullish(),
          order: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { items } = await listIncidents({
          ctx: toServiceCtx(ctx),
          input: {
            monitorId: input?.monitorId ?? undefined,
            period: input?.period,
            order: input?.order ?? "desc",
            // Same sentinel as status-report / maintenance — dashboard has
            // no paging UI; Connect-equivalent would cap externally.
            limit: 10_000,
            offset: 0,
          },
        });
        // Filter-and-log instead of throwing on orphaned rows: a single
        // incident missing its monitor (data-migration artifact, partial
        // cascade) shouldn't blow up the whole list and break the
        // `/overview` / `/monitors/:id/incidents` surfaces. We still log
        // so the inconsistency remains visible.
        return items.filter(hasMonitor);
      } catch (err) {
        toTRPCError(err);
      }
    }),

  acknowledge: protectedProcedure
    .meta({ track: Events.AcknowledgeIncident })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await acknowledgeIncident({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
        // Old contract was `return true`; preserve.
        return true;
      } catch (err) {
        toTRPCError(err);
      }
    }),

  resolve: protectedProcedure
    .meta({ track: Events.ResolveIncident })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await resolveIncident({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
        return true;
      } catch (err) {
        toTRPCError(err);
      }
    }),
});

/**
 * Type predicate: narrow `monitor` to non-null for the tRPC list return.
 * The old zod parse required `monitor: selectMonitorSchema`, so clients
 * rely on the non-null shape. An orphan here is a data-integrity signal
 * (FK `set default` on delete should prevent it, but migrations /
 * partial cascades have produced them historically) — we log and drop
 * rather than throw, so a single bad row can't break the whole list.
 */
function hasMonitor<T extends { id: number; monitor: unknown }>(
  incident: T,
): incident is T & { monitor: NonNullable<T["monitor"]> } {
  if (incident.monitor == null) {
    console.warn(
      `incident ${incident.id} has no associated monitor (data inconsistency); dropping from list`,
    );
    return false;
  }
  return true;
}
