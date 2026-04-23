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
        return items.map(narrowMonitor);
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
 * Narrow `monitor` to non-null for the tRPC list return — the old zod
 * parse required `monitor: selectMonitorSchema`. Every incident is expected
 * to have a monitor (FK with `set default` on delete), so a null here is a
 * data-integrity signal we surface rather than silently return.
 */
function narrowMonitor<T extends { id: number; monitor: unknown }>(
  incident: T,
): T & { monitor: NonNullable<T["monitor"]> } {
  if (incident.monitor == null) {
    throw new Error(
      `incident ${incident.id} has no associated monitor (data inconsistency)`,
    );
  }
  return incident as T & { monitor: NonNullable<T["monitor"]> };
}
