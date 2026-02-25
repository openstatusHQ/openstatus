import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { type SQL, and, count, eq, inArray } from "@openstatus/db";
import {
  NotificationDataSchema,
  googleChatDataSchema,
  grafanaOncallDataSchema,
  monitor,
  notification,
  notificationProvider,
  notificationsToMonitors,
  selectMonitorSchema,
  selectNotificationSchema,
  telegramDataSchema,
  whatsappDataSchema,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { SchemaError } from "@openstatus/error";
import { sendTest as sendGoogleChatTest } from "@openstatus/notification-google-chat";
import { sendTest as sendGrafanaTest } from "@openstatus/notification-grafana-oncall";
import { sendTest as sendTelegramTest } from "@openstatus/notification-telegram";
import { sendTest as sendWhatsAppTest } from "@openstatus/notification-twillio-whatsapp";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const notificationRouter = createTRPCRouter({
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
        })),
      );
  }),

  // TODO: rename to update after migration
  updateNotifier: protectedProcedure
    .meta({ track: Events.UpdateNotification })
    .input(
      z.object({
        id: z.number(),
        name: z.string(),
        data: z.partialRecord(
          z.enum(notificationProvider),
          z.string().or(z.record(z.string(), z.string())),
        ),
        monitors: z.array(z.number()),
      }),
    )
    .mutation(async (opts) => {
      const whereCondition: SQL[] = [
        eq(notification.id, opts.input.id),
        eq(notification.workspaceId, opts.ctx.workspace.id),
      ];

      const allMonitors = await opts.ctx.db.query.monitor.findMany({
        where: and(
          eq(monitor.workspaceId, opts.ctx.workspace.id),
          inArray(monitor.id, opts.input.monitors),
        ),
      });

      if (allMonitors.length !== opts.input.monitors.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to all the monitors.",
        });
      }

      const _data = NotificationDataSchema.safeParse(opts.input.data);

      if (!_data.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: SchemaError.fromZod(_data.error, opts.input).message,
        });
      }

      await opts.ctx.db.transaction(async (tx) => {
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
            and(eq(notificationsToMonitors.notificationId, opts.input.id)),
          );

        if (opts.input.monitors.length) {
          await tx.insert(notificationsToMonitors).values(
            opts.input.monitors.map((monitorId) => ({
              notificationId: opts.input.id,
              monitorId,
            })),
          );
        }
      });
    }),

  new: protectedProcedure
    .meta({ track: Events.CreateNotification, trackProps: ["provider"] })
    .input(
      z.object({
        provider: z.enum(notificationProvider),
        data: z.partialRecord(
          z.enum(notificationProvider),
          z.record(z.string(), z.string()).or(z.string()),
        ),
        name: z.string(),
        monitors: z.array(z.number()).prefault([]),
      }),
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
          inArray(monitor.id, opts.input.monitors),
        ),
      });

      if (allMonitors.length !== opts.input.monitors.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to all the monitors.",
        });
      }

      const limitedProviders = [
        "sms",
        "pagerduty",
        "opsgenie",
        "grafana-oncall",
        "whatsapp",
      ] as const;
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      if (limitedProviders.includes(opts.input.provider as any)) {
        const isAllowed =
          opts.ctx.workspace.limits[
            opts.input.provider as
              | "sms"
              | "pagerduty"
              | "opsgenie"
              | "grafana-oncall"
              | "whatsapp"
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

      const _notification = await opts.ctx.db.transaction(async (tx) => {
        const _notification = await tx
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
            })),
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
            eq(notification.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .run();
    }),

  sendTest: protectedProcedure
    .input(
      z.object({
        provider: z.enum(notificationProvider),
        data: z.partialRecord(
          z.enum(notificationProvider),
          z.record(z.string(), z.string()).or(z.string()),
        ),
      }),
    )
    .mutation(async (opts) => {
      if (opts.input.provider === "telegram") {
        const _data = telegramDataSchema.safeParse(opts.input.data);
        if (!_data.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: SchemaError.fromZod(_data.error, opts.input).message,
          });
        }
        await sendTelegramTest({
          chatId: _data.data.telegram.chatId,
        });

        return;
      }
      if (opts.input.provider === "whatsapp") {
        const _data = whatsappDataSchema.safeParse(opts.input.data);
        if (!_data.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: SchemaError.fromZod(_data.error, opts.input).message,
          });
        }
        await sendWhatsAppTest({ phoneNumber: _data.data.whatsapp });

        return;
      }
      if (opts.input.provider === "google-chat") {
        const _data = googleChatDataSchema.safeParse(opts.input.data);
        if (!_data.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: SchemaError.fromZod(_data.error, opts.input).message,
          });
        }

        await sendGoogleChatTest(_data.data["google-chat"]);
        return;
      }
      if (opts.input.provider === "grafana-oncall") {
        const _data = grafanaOncallDataSchema.safeParse(opts.input.data);
        if (!_data.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: SchemaError.fromZod(_data.error, opts.input).message,
          });
        }

        await sendGrafanaTest(_data.data["grafana-oncall"]);
        return;
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid provider",
      });
    }),
});
