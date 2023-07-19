import { z } from "zod";

import { eq } from "@openstatus/db";
import { insertMonitorSchema, monitor } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const monitorRouter = createTRPCRouter({
  createMonitor: protectedProcedure
    .input(insertMonitorSchema)
    .mutation(async (opts) => {
      await opts.ctx.db.insert(monitor).values(opts.input).run();
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
        .run();
    }),
  updateMonitor: protectedProcedure
    .input(insertMonitorSchema)
    .mutation(async (opts) => {
      console.log(opts.input);
      const r = await opts.ctx.db
        .update(monitor)
        .set(opts.input)
        .where(eq(monitor.id, Number(opts.input.id)))
        .execute();
      console.log(r);
      return r;
    }),
  updateMonitorStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: insertMonitorSchema.pick({ periodicity: true }),
      }),
    )
    .mutation(async (opts) => {
      return await opts.ctx.db
        .update(monitor)
        .set(opts.input.status)
        .where(eq(monitor.id, opts.input.id))
        .run();
    }),

  deleteMonitor: protectedProcedure
    .input(z.object({ monitorId: z.number() }))
    .mutation(async (opts) => {
      await opts.ctx.db
        .delete(monitor)
        .where(eq(monitor.id, opts.input.monitorId))
        .run();
    }),
  getMonitorsByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.number() }))
    .query(async (opts) => {
      return await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.workspaceId, opts.input.workspaceId))
        .run();
    }),
});
