import { z } from "zod";

import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  syncMaintenanceToMonitorDeleteByMaintenance,
  syncMaintenanceToMonitorInsertMany,
} from "@openstatus/db";
import {
  maintenance,
  maintenancesToMonitors,
  monitor,
  selectMaintenanceSchema,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getPeriodDate, periods } from "./utils";

export const maintenanceRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const _maintenance = await opts.ctx.db
        .select()
        .from(maintenance)
        .where(
          and(
            eq(maintenance.id, opts.input.id),
            eq(maintenance.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .get();

      if (!_maintenance) return undefined;
      // TODO: make it work with `with: { maintenacesToMonitors: true }`
      const _monitors = await opts.ctx.db
        .select()
        .from(maintenancesToMonitors)
        .where(eq(maintenancesToMonitors.maintenanceId, _maintenance.id))
        .all();
      return { ..._maintenance, monitors: _monitors.map((m) => m.monitorId) };
    }),
  getByWorkspace: protectedProcedure.query(async (opts) => {
    const _maintenances = await opts.ctx.db
      .select()
      .from(maintenance)
      .where(eq(maintenance.workspaceId, opts.ctx.workspace.id))
      .all();
    return _maintenances;
  }),
  getLast7DaysByWorkspace: protectedProcedure.query(async (opts) => {
    const _maintenances = await opts.ctx.db.query.maintenance.findMany({
      where: and(
        eq(maintenance.workspaceId, opts.ctx.workspace.id),
        gte(maintenance.from, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      ),
      with: { maintenancesToMonitors: true },
    });
    return _maintenances.map((m) => ({
      ...m,
      monitors: m.maintenancesToMonitors.map((m) => m.monitorId),
    }));
  }),
  getByPage: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const _maintenances = await opts.ctx.db
        .select()
        .from(maintenance)
        .where(
          and(
            eq(maintenance.pageId, opts.input.id),
            eq(maintenance.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .all();
      // TODO:
      return _maintenances;
    }),
  getActiveByWorkspace: protectedProcedure.query(async (opts) => {
    const _maintenances = await opts.ctx.db
      .select()
      .from(maintenance)
      .where(
        and(
          eq(maintenance.workspaceId, opts.ctx.workspace.id),
          gte(maintenance.to, new Date()),
          lte(maintenance.from, new Date()),
        ),
      )
      .all();
    return _maintenances;
  }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteMaintenance })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      return await opts.ctx.db
        .delete(maintenance)
        .where(
          and(
            eq(maintenance.id, opts.input.id),
            eq(maintenance.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .returning();
    }),

  // DASHBOARD

  list: protectedProcedure
    .input(
      z
        .object({
          /**
           * Time period for filtering maintenances (e.g., "1d", "7d", "14d")
           * Takes precedence over createdAt if provided
           */
          period: z.enum(periods).optional(),
          pageId: z.number().optional(),
          order: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(maintenance.workspaceId, opts.ctx.workspace.id),
      ];

      // Use period if provided, otherwise fall back to createdAt
      if (opts.input?.period) {
        whereConditions.push(
          gte(maintenance.createdAt, getPeriodDate(opts.input.period)),
        );
      }

      if (opts.input?.pageId) {
        whereConditions.push(eq(maintenance.pageId, opts.input.pageId));
      }

      const query = opts.ctx.db.query.maintenance.findMany({
        where: and(...whereConditions),
        orderBy:
          opts.input?.order === "asc"
            ? asc(maintenance.createdAt)
            : desc(maintenance.createdAt),
        with: { maintenancesToMonitors: true },
      });

      const result = await query;

      return selectMaintenanceSchema.array().parse(
        result.map((m) => ({
          ...m,
          monitors: m.maintenancesToMonitors.map((m) => m.monitorId),
        })),
      );
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
        monitors: z.array(z.number()).optional(),
        notifySubscribers: z.boolean().nullish(),
      }),
    )
    .mutation(async (opts) => {
      // Check if the user has access to the monitors
      if (opts.input.monitors?.length) {
        const whereConditions: SQL[] = [
          eq(monitor.workspaceId, opts.ctx.workspace.id),
          inArray(monitor.id, opts.input.monitors),
        ];
        const monitors = await opts.ctx.db
          .select()
          .from(monitor)
          .where(and(...whereConditions))
          .all();

        if (monitors.length !== opts.input.monitors.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You do not have access to all the monitors",
          });
        }
      }

      const newMaintenance = await opts.ctx.db.transaction(async (tx) => {
        const newMaintenance = await tx
          .insert(maintenance)
          .values({
            pageId: opts.input.pageId,
            workspaceId: opts.ctx.workspace.id,
            title: opts.input.title,
            message: opts.input.message,
            from: opts.input.startDate,
            to: opts.input.endDate,
          })
          .returning()
          .get();

        if (opts.input.monitors?.length) {
          await tx.insert(maintenancesToMonitors).values(
            opts.input.monitors.map((monitorId) => ({
              maintenanceId: newMaintenance.id,
              monitorId,
            })),
          );
          // Sync to page components
          await syncMaintenanceToMonitorInsertMany(
            tx,
            newMaintenance.id,
            opts.input.monitors,
          );
        }

        return newMaintenance;
      });

      return {
        ...newMaintenance,
        notifySubscribers: opts.input.notifySubscribers,
      };
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
        monitors: z.array(z.number()).optional(),
      }),
    )
    .mutation(async (opts) => {
      // Check if the user has access to the monitors
      if (opts.input.monitors?.length) {
        const whereConditions: SQL[] = [
          eq(monitor.workspaceId, opts.ctx.workspace.id),
          inArray(monitor.id, opts.input.monitors),
        ];
        const monitors = await opts.ctx.db
          .select()
          .from(monitor)
          .where(and(...whereConditions))
          .all();

        if (monitors.length !== opts.input.monitors.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You do not have access to all the monitors",
          });
        }
      }

      await opts.ctx.db.transaction(async (tx) => {
        const whereConditions: SQL[] = [
          eq(maintenance.id, opts.input.id),
          eq(maintenance.workspaceId, opts.ctx.workspace.id),
        ];

        // Update the maintenance
        const _maintenance = await tx
          .update(maintenance)
          .set({
            title: opts.input.title,
            message: opts.input.message,
            from: opts.input.startDate,
            to: opts.input.endDate,
            workspaceId: opts.ctx.workspace.id,
            updatedAt: new Date(),
          })
          .where(and(...whereConditions))
          .returning()
          .get();

        // Delete all existing relations
        await tx
          .delete(maintenancesToMonitors)
          .where(eq(maintenancesToMonitors.maintenanceId, _maintenance.id))
          .run();
        // Sync delete to page components
        await syncMaintenanceToMonitorDeleteByMaintenance(tx, _maintenance.id);

        // Create new relations if monitors are provided
        if (opts.input.monitors?.length) {
          await tx.insert(maintenancesToMonitors).values(
            opts.input.monitors.map((monitorId) => ({
              maintenanceId: _maintenance.id,
              monitorId,
            })),
          );
          // Sync to page components
          await syncMaintenanceToMonitorInsertMany(
            tx,
            _maintenance.id,
            opts.input.monitors,
          );
        }

        return _maintenance;
      });
    }),
});
