import { z } from "zod";

import { and, asc, desc, eq, gte, inArray, lte, SQL } from "@openstatus/db";
import {
  insertMaintenanceSchema,
  maintenance,
  maintenancesToMonitors,
  monitor,
  monitorsToPages,
  selectMaintenanceSchema,
  selectMonitorSchema,
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
            }))
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
            eq(maintenance.workspaceId, opts.ctx.workspace.id)
          )
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
        gte(maintenance.from, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
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
            eq(maintenance.workspaceId, opts.ctx.workspace.id)
          )
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
          lte(maintenance.from, new Date())
        )
      )
      .all();
    return _maintenances;
  }),
  updateLegacy: protectedProcedure
    .meta({ track: Events.UpdateMaintenance })
    .input(insertMaintenanceSchema)
    .mutation(async (opts) => {
      if (!opts.input.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "id is required" });
      }

      const _maintenance = await opts.ctx.db
        .update(maintenance)
        .set({
          ...opts.input,
          workspaceId: opts.ctx.workspace.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(maintenance.id, opts.input.id),
            eq(maintenance.workspaceId, opts.ctx.workspace.id)
          )
        )
        .returning()
        .get();

      const _maintenancesToMonitors = await opts.ctx.db
        .select()
        .from(maintenancesToMonitors)
        .where(eq(maintenancesToMonitors.maintenanceId, _maintenance.id))
        .all();

      const _monitorsIds = _maintenancesToMonitors.map(
        ({ monitorId }) => monitorId
      );

      const added = opts.input.monitors?.filter(
        (monitor) => !_monitorsIds.includes(monitor)
      );

      if (added?.length) {
        await opts.ctx.db
          .insert(maintenancesToMonitors)
          .values(
            added.map((monitorId) => ({
              maintenanceId: _maintenance.id,
              monitorId,
            }))
          )
          .returning()
          .get();
      }

      const removed = _monitorsIds.filter(
        (monitor) => !opts.input.monitors?.includes(monitor)
      );

      if (removed?.length) {
        await opts.ctx.db
          .delete(maintenancesToMonitors)
          .where(
            and(
              eq(maintenancesToMonitors.maintenanceId, _maintenance.id),
              inArray(maintenancesToMonitors.monitorId, removed)
            )
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
            eq(maintenance.workspaceId, opts.ctx.workspace.id)
          )
        )
        .returning();
    }),

  // DASHBOARD

  list: protectedProcedure
    .input(
      z
        .object({
          createdAt: z
            .object({
              gte: z.date().optional(),
            })
            .optional(),
          pageId: z.number().optional(),
          order: z.enum(["asc", "desc"]).optional(),
        })
        .optional()
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(maintenance.workspaceId, opts.ctx.workspace.id),
      ];

      if (opts.input?.createdAt?.gte) {
        whereConditions.push(
          gte(maintenance.createdAt, opts.input.createdAt.gte)
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
        }))
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
      })
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
            }))
          );
        }

        return newMaintenance;
      });
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
      })
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

        // Create new relations if monitors are provided
        if (opts.input.monitors?.length) {
          await tx.insert(maintenancesToMonitors).values(
            opts.input.monitors.map((monitorId) => ({
              maintenanceId: _maintenance.id,
              monitorId,
            }))
          );
        }

        return _maintenance;
      });
    }),
});
