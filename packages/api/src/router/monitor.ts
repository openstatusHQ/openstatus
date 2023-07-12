import { z } from "zod";

import { eq } from "@openstatus/db";
import { insertMonitorSchema, monitor } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const monitorRouter = createTRPCRouter({
  createMonitor: protectedProcedure
    .input(insertMonitorSchema)
    .mutation(async (opts) => {
      await opts.ctx.db.insert(monitor).values(opts.input).execute();
    }),

  getMonitorById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      return await opts.ctx.db.query.monitor
        .findFirst({ where: eq(monitor.id, opts.input.id) })
        .execute();
    }),

  updateMonitorDescription: protectedProcedure
    .input(
      z.object({
        monitorId: z.number(),
        description: z.string(),
      }),
    )
    .mutation(async (opts) => {
      await opts.ctx.db
        .update(monitor)
        .set({ description: opts.input.description })
        .where(eq(monitor.id, opts.input.monitorId))
        .execute();
    }),

  updateMonitorStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: insertMonitorSchema.pick({ periodicity: true }),
      }),
    )
    .mutation(async (opts) => {
      await opts.ctx.db
        .update(monitor)
        .set(opts.input.status)
        .where(eq(monitor.id, opts.input.id))
        .execute();
    }),

  deleteMonitor: protectedProcedure
    .input(z.object({ monitorId: z.number() }))
    .mutation(async (opts) => {
      await opts.ctx.db
        .delete(monitor)
        .where(eq(monitor.id, opts.input.monitorId));
    }),
  getMonitorsByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.number() }))
    .query(async (opts) => {
      return await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.workspaceId, opts.input.workspaceId))
        .execute();
    }),
});
