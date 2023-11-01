import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, inArray, sql } from "@openstatus/db";
import {
  insertMonitorSchema,
  monitor,
  monitorPeriodicitySchema,
  monitorsToPages,
  notification,
  notificationsToMonitors,
  selectMonitorSchema,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/plans";

import { trackNewMonitor } from "../analytics";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const monitorRouter = createTRPCRouter({
  create: protectedProcedure
    .input(insertMonitorSchema)
    .output(selectMonitorSchema)
    .mutation(async (opts) => {
      const monitorLimit = allPlans[opts.ctx.workspace.plan].limits.monitors;
      const periodicityLimit =
        allPlans[opts.ctx.workspace.plan].limits.periodicity;

      const monitorNumbers = (
        await opts.ctx.db.query.monitor.findMany({
          where: eq(monitor.workspaceId, opts.ctx.workspace.id),
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
        opts.input.periodicity &&
        !periodicityLimit.includes(opts.input.periodicity)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your cron job limits.",
        });
      }

      // FIXME: this is a hotfix
      const { regions, headers, notifications, id, ...data } = opts.input;

      const newMonitor = await opts.ctx.db
        .insert(monitor)
        .values({
          // REMINDER: We should explicitly pass the corresponding attributes
          // otherwise, unexpected attributes will be passed
          ...data,
          workspaceId: opts.ctx.workspace.id,
          regions: regions?.join(","),
          headers: headers ? JSON.stringify(headers) : undefined,
        })
        .returning()
        .get();

      if (Boolean(notifications.length)) {
        // We should make sure the user has access to the notifications
        const allNotifications = await opts.ctx.db.query.notification.findMany({
          where: inArray(notification.id, notifications),
        });

        const values = allNotifications.map((notification) => ({
          monitorId: newMonitor.id,
          notificationId: notification.id,
        }));

        await opts.ctx.db.insert(notificationsToMonitors).values(values).run();
      }

      trackNewMonitor(opts.ctx.user, {
        url: newMonitor.url,
        periodicity: newMonitor.periodicity,
      });

      return selectMonitorSchema.parse(newMonitor);
    }),

  getMonitorById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .output(selectMonitorSchema) // REMINDER: use more!
    .query(async (opts) => {
      const currentMonitor = await opts.ctx.db
        .select()
        .from(monitor)
        .where(
          and(
            eq(monitor.id, opts.input.id),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .get();
      return selectMonitorSchema.parse(currentMonitor);
    }),

  update: protectedProcedure
    .input(insertMonitorSchema)
    .mutation(async (opts) => {
      if (!opts.input.id) return;

      const periodicityLimit =
        allPlans[opts.ctx.workspace.plan].limits.periodicity;

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

      const { regions, headers, notifications, ...data } = opts.input;

      const currentMonitor = await opts.ctx.db
        .update(monitor)
        .set({
          ...data,
          regions: regions?.join(","),
          updatedAt: new Date(),
          headers: headers ? JSON.stringify(headers) : undefined,
        })
        .where(
          and(
            eq(monitor.id, opts.input.id),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .returning()
        .get();

      const currentMonitorNotifications = await opts.ctx.db
        .select()
        .from(notificationsToMonitors)
        .where(eq(notificationsToMonitors.monitorId, currentMonitor.id))
        .all();

      const addedNotifications = notifications.filter(
        (x) =>
          !currentMonitorNotifications
            .map(({ notificationId }) => notificationId)
            ?.includes(x),
      );

      if (Boolean(addedNotifications.length)) {
        const values = addedNotifications.map((notificationId) => ({
          monitorId: currentMonitor.id,
          notificationId,
        }));

        await opts.ctx.db.insert(notificationsToMonitors).values(values).run();
      }

      const removedNotifications = currentMonitorNotifications
        .map(({ notificationId }) => notificationId)
        .filter((x) => !notifications?.includes(x));

      if (Boolean(removedNotifications.length)) {
        await opts.ctx.db
          .delete(notificationsToMonitors)
          .where(
            and(
              eq(notificationsToMonitors.monitorId, currentMonitor.id),
              inArray(
                notificationsToMonitors.notificationId,
                removedNotifications,
              ),
            ),
          )
          .run();
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const monitorToDelete = await opts.ctx.db
        .select()
        .from(monitor)
        .where(
          and(
            eq(monitor.id, opts.input.id),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .get();
      if (!monitorToDelete) return;

      await opts.ctx.db
        .delete(monitor)
        .where(eq(monitor.id, monitorToDelete.id))
        .run();
    }),

  getMonitorsByWorkspace: protectedProcedure
    .output(z.array(selectMonitorSchema))
    .query(async (opts) => {
      const monitors = await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.workspaceId, opts.ctx.workspace.id))
        .all();

      return z.array(selectMonitorSchema).parse(monitors);
    }),

  getMonitorsForPeriodicity: protectedProcedure
    .input(z.object({ periodicity: monitorPeriodicitySchema }))
    .query(async (opts) => {
      const result = await opts.ctx.db
        .select()
        .from(monitor)
        .where(
          and(
            eq(monitor.periodicity, opts.input.periodicity),
            eq(monitor.active, true),
          ),
        )
        .all();
      return z.array(selectMonitorSchema).parse(result);
    }),

  getAllPagesForMonitor: protectedProcedure
    .input(z.object({ monitorId: z.number() }))
    .query(async (opts) => {
      const allPages = await opts.ctx.db
        .select()
        .from(monitorsToPages)
        .where(eq(monitorsToPages.monitorId, opts.input.monitorId))
        .all();
      return allPages;
    }),

  // rename to getActiveMonitorsCount
  getTotalActiveMonitors: publicProcedure.query(async (opts) => {
    const monitors = await opts.ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(monitor)
      .where(eq(monitor.active, true))
      .all();
    if (monitors.length === 0) return 0;
    return monitors[0].count;
  }),

  // TODO: return the notifications inside of the `getMonitorById` like we do for the monitors on a status page
  getAllNotificationsForMonitor: protectedProcedure
    .input(z.object({ id: z.number() }))
    // .output(selectMonitorSchema)
    .query(async (opts) => {
      const data = await opts.ctx.db
        .select()
        .from(notificationsToMonitors)
        .innerJoin(
          notification,
          and(
            eq(notificationsToMonitors.notificationId, notification.id),
            eq(notification.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .where(eq(notificationsToMonitors.monitorId, opts.input.id))
        .all();
      return data.map((d) => selectNotificationSchema.parse(d.notification));
    }),
});
