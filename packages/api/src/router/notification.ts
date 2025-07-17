import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, count, db, eq, inArray, type SQL } from "@openstatus/db";
import {
  NotificationDataSchema,
  NotificationProvider,
  insertNotificationSchema,
  monitor,
  notification,
  notificationProvider,
  notificationsToMonitors,
  selectMonitorSchema,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { SchemaError } from "@openstatus/error";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const notificationRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.CreateNotification })
    .input(insertNotificationSchema)
    .mutation(async (opts) => {
      const { monitors, ...props } = opts.input;

      const notificationLimit =
        opts.ctx.workspace.limits["notification-channels"];

      const notificationNumber = (
        await opts.ctx.db.query.notification.findMany({
          where: eq(notification.workspaceId, opts.ctx.workspace.id),
        })
      ).length;

      // the user has reached the limits
      if (notificationNumber >= notificationLimit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your notification limits.",
        });
      }

      const limitedProviders = ["sms", "pagerduty", "opsgenie"];
      if (limitedProviders.includes(props.provider)) {
        const isAllowed =
          opts.ctx.workspace.limits[
            props.provider as "sms" | "pagerduty" | "opsgenie"
          ];

        if (!isAllowed) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Upgrade to use the notification channel.",
          });
        }
      }

      const _data = NotificationDataSchema.safeParse(JSON.parse(props.data));

      if (!_data.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: SchemaError.fromZod(_data.error, props).message,
        });
      }

      const _notification = await opts.ctx.db
        .insert(notification)
        .values({ ...props, workspaceId: opts.ctx.workspace.id })
        .returning()
        .get();

      const values = monitors.map((monitorId) => ({
        notificationId: _notification.id,
        monitorId,
      }));

      if (values.length) {
        await opts.ctx.db.insert(notificationsToMonitors).values(values);
      }

      return _notification;
    }),

  update: protectedProcedure
    .meta({ track: Events.UpdateNotification })
    .input(insertNotificationSchema)
    .mutation(async (opts) => {
      if (!opts.input.id) return;

      const { monitors, ...props } = opts.input;

      const _data = NotificationDataSchema.safeParse(JSON.parse(props.data));

      if (!_data.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: SchemaError.fromZod(_data.error, props).message,
        });
      }

      const currentNotification = await opts.ctx.db
        .update(notification)
        .set({ ...props, updatedAt: new Date() })
        .where(
          and(
            eq(notification.id, opts.input.id),
            eq(notification.workspaceId, opts.ctx.workspace.id)
          )
        )
        .returning()
        .get();

      // TODO: relation

      if (monitors.length) {
        const allMonitors = await opts.ctx.db.query.monitor.findMany({
          where: and(
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            inArray(monitor.id, monitors)
          ),
        });

        if (allMonitors.length !== monitors.length) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to all the monitors.",
          });
        }
      }

      const currentMonitorsToNotifications = await opts.ctx.db
        .select()
        .from(notificationsToMonitors)
        .where(
          eq(notificationsToMonitors.notificationId, currentNotification.id)
        )
        .all();

      const removedMonitors = currentMonitorsToNotifications
        .map(({ monitorId }) => monitorId)
        .filter((x) => !monitors?.includes(x));

      if (removedMonitors.length) {
        await opts.ctx.db
          .delete(notificationsToMonitors)
          .where(
            and(
              inArray(notificationsToMonitors.monitorId, removedMonitors),
              eq(notificationsToMonitors.notificationId, currentNotification.id)
            )
          );
      }

      const values = monitors.map((monitorId) => ({
        notificationId: currentNotification.id,
        monitorId,
      }));

      if (values.length) {
        await opts.ctx.db
          .insert(notificationsToMonitors)
          .values(values)
          .onConflictDoNothing();
      }

      return currentNotification;
    }),

  deleteNotification: protectedProcedure
    .meta({ track: Events.DeleteNotification })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      await opts.ctx.db
        .delete(notification)
        .where(
          and(
            eq(notification.id, opts.input.id),
            eq(notification.id, opts.input.id)
          )
        )
        .run();
    }),

  getNotificationById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const _notification = await opts.ctx.db.query.notification.findFirst({
        where: and(
          eq(notification.id, opts.input.id),
          eq(notification.id, opts.input.id),
          eq(notification.workspaceId, opts.ctx.workspace.id)
        ),
        // FIXME: plural
        with: { monitor: { with: { monitor: true } } },
      });

      const schema = selectNotificationSchema.extend({
        monitor: z.array(
          z.object({
            monitor: selectMonitorSchema,
          })
        ),
      });

      return schema.parse(_notification);
    }),

  getNotificationsByWorkspace: protectedProcedure.query(async (opts) => {
    const notifications = await opts.ctx.db.query.notification.findMany({
      where: and(eq(notification.workspaceId, opts.ctx.workspace.id)),
      with: {
        // FIXME: first should be plurals!
        monitor: { with: { monitor: true } },
      },
    });

    const schema = selectNotificationSchema.extend({
      monitor: z.array(
        z.object({
          monitor: selectMonitorSchema,
        })
      ),
    });

    return z.array(schema).parse(notifications);
  }),

  isNotificationLimitReached: protectedProcedure.query(async (opts) => {
    const notificationLimit =
      opts.ctx.workspace.limits["notification-channels"];
    const notificationNumbers = (
      await opts.ctx.db.query.notification.findMany({
        where: eq(notification.workspaceId, opts.ctx.workspace.id),
      })
    ).length;

    return notificationNumbers >= notificationLimit;
  }),

  list: protectedProcedure.query(async (opts) => {
    const notifications = await opts.ctx.db.query.notification.findMany({
      where: eq(notification.workspaceId, opts.ctx.workspace.id),
      with: {
        monitor: {
          with: {
            monitor: true,
          },
        },
      },
    });

    return selectNotificationSchema
      .extend({
        monitors: selectMonitorSchema.array(),
      })
      .array()
      .parse(
        notifications.map((notification) => ({
          ...notification,
          monitors: notification.monitor.map(({ monitor }) => monitor),
        }))
      );
  }),

  // TODO: rename to update after migration
  updateNotifier: protectedProcedure
    .meta({ track: Events.UpdateNotification })
    .input(
      z.object({
        id: z.number(),
        name: z.string(),
        data: z.record(
          z.string(),
          z.string().or(z.record(z.string(), z.string()))
        ),
        monitors: z.array(z.number()),
      })
    )
    .mutation(async (opts) => {
      const whereCondition: SQL[] = [
        eq(notification.id, opts.input.id),
        eq(notification.workspaceId, opts.ctx.workspace.id),
      ];

      const allMonitors = await opts.ctx.db.query.monitor.findMany({
        where: and(
          eq(monitor.workspaceId, opts.ctx.workspace.id),
          inArray(monitor.id, opts.input.monitors)
        ),
      });

      if (allMonitors.length !== opts.input.monitors.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to all the monitors.",
        });
      }

      db.transaction(async (tx) => {
        await tx
          .update(notification)
          .set({
            name: opts.input.name,
            data: JSON.stringify(opts.input.data),
            updatedAt: new Date(),
          })
          .where(and(...whereCondition));

        await tx
          .delete(notificationsToMonitors)
          .where(
            and(eq(notificationsToMonitors.notificationId, opts.input.id))
          );

        await tx.insert(notificationsToMonitors).values(
          opts.input.monitors.map((monitorId) => ({
            notificationId: opts.input.id,
            monitorId,
          }))
        );
      });
    }),

  new: protectedProcedure
    .meta({ track: Events.CreateNotification })
    .input(
      z.object({
        provider: z.enum(notificationProvider),
        data: z.record(
          z.enum(notificationProvider),
          z.record(z.string(), z.string()).or(z.string())
        ),
        name: z.string(),
        monitors: z.array(z.number()).default([]),
      })
    )
    .mutation(async (opts) => {
      const limits = opts.ctx.workspace.limits;

      const res = await opts.ctx.db
        .select({ count: count() })
        .from(notification)
        .where(eq(notification.workspaceId, opts.ctx.workspace.id))
        .get();

      // the user has reached the limits
      if (res && res.count >= limits["notification-channels"]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your notification limits.",
        });
      }

      const allMonitors = await opts.ctx.db.query.monitor.findMany({
        where: and(
          eq(monitor.workspaceId, opts.ctx.workspace.id),
          inArray(monitor.id, opts.input.monitors)
        ),
      });

      if (allMonitors.length !== opts.input.monitors.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to all the monitors.",
        });
      }

      const limitedProviders = ["sms", "pagerduty", "opsgenie"] as const;
      if (limitedProviders.includes(opts.input.provider as any)) {
        const isAllowed =
          opts.ctx.workspace.limits[
            opts.input.provider as "sms" | "pagerduty" | "opsgenie"
          ];

        if (!isAllowed) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Upgrade to use the notification channel.",
          });
        }
      }

      const _data = NotificationDataSchema.safeParse(opts.input.data);

      if (!_data.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: SchemaError.fromZod(_data.error, opts.input).message,
        });
      }

      const _notification = await db.transaction(async (tx) => {
        const _notification = await opts.ctx.db
          .insert(notification)
          .values({
            name: opts.input.name,
            provider: opts.input.provider,
            data: JSON.stringify(opts.input.data),
            workspaceId: opts.ctx.workspace.id,
          })
          .returning()
          .get();

        if (opts.input.monitors.length) {
          await tx.insert(notificationsToMonitors).values(
            opts.input.monitors.map((monitorId) => ({
              notificationId: _notification.id,
              monitorId,
            }))
          );
        }

        return _notification;
      });

      return _notification;
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteNotification })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      await opts.ctx.db
        .delete(notification)
        .where(
          and(
            eq(notification.id, opts.input.id),
            eq(notification.workspaceId, opts.ctx.workspace.id)
          )
        )
        .run();
    }),
});
