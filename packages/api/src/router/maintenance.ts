import { z } from "zod";

import { and, eq, gte, inArray, lte } from "@openstatus/db";
import {
  insertMaintenanceSchema,
  maintenance,
  maintenancesToMonitors,
  selectMaintenanceSchema,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const maintenanceRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.CreateMaintenance })
    .input(insertMaintenanceSchema)
    .mutation(async (opts) => {
      const _maintenance = await opts.ctx.db
        .insert(maintenance)
        .values({ ...opts.input, workspaceId: opts.ctx.workspace.id })
        .returning()
        .get();

      if (opts.input.monitors?.length) {
        await opts.ctx.db
          .insert(maintenancesToMonitors)
          .values(
            opts.input.monitors.map((monitorId) => ({
              maintenanceId: _maintenance.id,
              monitorId,
            })),
          )
          .returning()
          .get();
      }

      return _maintenance;
    }),
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
  update: protectedProcedure
    .meta({ track: Events.UpdateMaintenance })
    .input(insertMaintenanceSchema)
    .mutation(async (opts) => {
      if (!opts.input.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "id is required" });
      }

      const _maintenance = await opts.ctx.db
        .update(maintenance)
        .set({ ...opts.input, workspaceId: opts.ctx.workspace.id })
        .where(
          and(
            eq(maintenance.id, opts.input.id),
            eq(maintenance.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .returning()
        .get();

      const _maintenancesToMonitors = await opts.ctx.db
        .select()
        .from(maintenancesToMonitors)
        .where(eq(maintenancesToMonitors.maintenanceId, _maintenance.id))
        .all();

      const _monitorsIds = _maintenancesToMonitors.map(
        ({ monitorId }) => monitorId,
      );

      const added = opts.input.monitors?.filter(
        (monitor) => !_monitorsIds.includes(monitor),
      );

      if (added?.length) {
        await opts.ctx.db
          .insert(maintenancesToMonitors)
          .values(
            added.map((monitorId) => ({
              maintenanceId: _maintenance.id,
              monitorId,
            })),
          )
          .returning()
          .get();
      }

      const removed = _monitorsIds.filter(
        (monitor) => !opts.input.monitors?.includes(monitor),
      );

      if (removed?.length) {
        await opts.ctx.db
          .delete(maintenancesToMonitors)
          .where(
            and(
              eq(maintenancesToMonitors.maintenanceId, _maintenance.id),
              inArray(maintenancesToMonitors.monitorId, removed),
            ),
          )
          .run();
      }

      return _maintenance;
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
});
