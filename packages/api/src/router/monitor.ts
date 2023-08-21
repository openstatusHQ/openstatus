import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { analytics, trackAnalytics } from "@openstatus/analytics";
import { eq } from "@openstatus/db";
import {
  allMonitorsSchema,
  insertMonitorSchema,
  METHODS,
  monitor,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/plans";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { hasUserAccessToMonitor, hasUserAccessToWorkspace } from "./utils";

export const monitorRouter = createTRPCRouter({
  createMonitor: protectedProcedure
    .input(z.object({ data: insertMonitorSchema, workspaceSlug: z.string() }))
    .mutation(async (opts) => {
      const result = await hasUserAccessToWorkspace({
        workspaceSlug: opts.input.workspaceSlug,
        ctx: opts.ctx,
      });

      if (!result) return;

      const monitorLimit = result.plan.limits.monitors;
      const periodicityLimit = result.plan.limits.periodicity;

      const monitorNumbers = (
        await opts.ctx.db.query.monitor.findMany({
          where: eq(monitor.workspaceId, result.workspace.id),
        })
      ).length;

      // the user has reached the limits
      if (monitorNumbers >= monitorLimit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your monitor limits.",
        });
      }

      // the user is not allowed to use the cron job
      if (
        opts.input.data?.periodicity &&
        !periodicityLimit.includes(opts.input.data?.periodicity)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your cron job limits.",
        });
      }
      const { regions, ...data } = opts.input.data;

      const newMonitor = await opts.ctx.db
        .insert(monitor)
        .values({
          ...data,
          workspaceId: result.workspace.id,
          regions: regions?.join(","),
        })
        .returning()
        .get();

      await analytics.identify(result.user.id, {
        userId: result.user.id,
      });
      await trackAnalytics({
        event: "Monitor Created",
        url: newMonitor.url,
        periodicity: newMonitor.periodicity,
      });
    }),

  getMonitorByID: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      if (!opts.input.id) return;
      const result = await hasUserAccessToMonitor({
        monitorId: opts.input.id,
        ctx: opts.ctx,
      });
      if (!result) return;

      const _monitor = selectMonitorSchema.parse(result.monitor);
      console.log(_monitor);
      return _monitor;
    }),

  // TODO: delete
  updateMonitorDescription: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        description: z.string(),
      }),
    )
    .mutation(async (opts) => {
      //  We make sure user as access to this workspace and the monitor
      if (!opts.input.id) return;
      const result = await hasUserAccessToMonitor({
        monitorId: opts.input.id,
        ctx: opts.ctx,
      });
      if (!result) return;

      await opts.ctx.db
        .update(monitor)
        .set({ description: opts.input.description })
        .where(eq(monitor.id, opts.input.id))
        .run();
    }),
  updateMonitor: protectedProcedure
    .input(insertMonitorSchema)
    .mutation(async (opts) => {
      if (!opts.input.id) return;
      const result = await hasUserAccessToMonitor({
        monitorId: opts.input.id,
        ctx: opts.ctx,
      });
      if (!result) return;

      const plan = (result.workspace?.plan || "free") as "free" | "pro";

      const periodicityLimit = allPlans[plan].limits.periodicity;

      // the user is not allowed to use the cron job
      if (
        opts.input?.periodicity &&
        !periodicityLimit.includes(opts.input?.periodicity)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your cron job limits.",
        });
      }
      console.log(opts.input.regions?.join(","));
      const { regions, ...data } = opts.input;
      await opts.ctx.db
        .update(monitor)
        .set({ ...data, regions: regions?.join(","), updatedAt: new Date() })
        .where(eq(monitor.id, opts.input.id))
        .returning()
        .get();
    }),
  // TODO: delete
  updateMonitorPeriodicity: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        data: insertMonitorSchema.pick({ periodicity: true }),
      }),
    )
    .mutation(async (opts) => {
      const result = await hasUserAccessToMonitor({
        monitorId: opts.input.id,
        ctx: opts.ctx,
      });
      if (!result) return;

      await opts.ctx.db
        .update(monitor)
        .set({
          periodicity: opts.input.data.periodicity,
          updatedAt: new Date(),
        })
        .where(eq(monitor.id, opts.input.id))
        .run();
    }),

  deleteMonitor: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const result = await hasUserAccessToMonitor({
        monitorId: opts.input.id,
        ctx: opts.ctx,
      });
      if (!result) return;
      await opts.ctx.db
        .delete(monitor)
        .where(eq(monitor.id, result.monitor.id))
        .run();
    }),
  getMonitorsByWorkspace: protectedProcedure
    .input(z.object({ workspaceSlug: z.string() }))
    .query(async (opts) => {
      // Check if user has access to workspace
      const data = await hasUserAccessToWorkspace({
        workspaceSlug: opts.input.workspaceSlug,
        ctx: opts.ctx,
      });
      if (!data) return;

      const monitors = await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.workspaceId, data.workspace.id))
        .all();
      // const selectMonitorsArray = selectMonitorSchema.array();

      return allMonitorsSchema.parse(monitors);
    }),

  updateMonitorAdvanced: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        method: z.enum(METHODS).default("GET"),
        body: z.string().default("").optional(),
        headers: z
          .array(z.object({ key: z.string(), value: z.string() }))
          .transform((val) => JSON.stringify(val))
          .default([])
          .optional(),
      }),
    )
    .mutation(async (opts) => {
      const result = await hasUserAccessToMonitor({
        monitorId: opts.input.id,
        ctx: opts.ctx,
      });
      if (!result) return;
      await opts.ctx.db
        .update(monitor)
        .set({
          method: opts.input.method,
          body: opts.input.body,
          headers: opts.input.headers,
        })
        .where(eq(monitor.id, opts.input.id))
        .run();
    }),
});
