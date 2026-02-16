import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { type SQL, and, count, db, eq, inArray } from "@openstatus/db";
import {
  NotificationDataSchema,
  googleChatDataSchema,
  grafanaOncallDataSchema,
  insertNotificationSchema,
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
import { redis } from "@openstatus/upstash";
import { nanoid } from "nanoid";

import { createTRPCRouter, protectedProcedure } from "../trpc";

// Telegram API Types
interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  language_code?: string;
}

interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  first_name?: string;
  all_members_are_administrators?: boolean;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: Array<{
    offset: number;
    length: number;
    type: string;
  }>;
  new_chat_members?: TelegramUser[];
  new_chat_member?: TelegramUser;
  new_chat_participant?: TelegramUser;
}

interface TelegramChatMember {
  user: TelegramUser;
  status: "member" | "administrator" | "left" | "creator" | "restricted" | "kicked";
  can_be_edited?: boolean;
  can_manage_chat?: boolean;
  can_change_info?: boolean;
  can_delete_messages?: boolean;
  can_invite_users?: boolean;
  can_restrict_members?: boolean;
  can_pin_messages?: boolean;
  can_manage_topics?: boolean;
  can_promote_members?: boolean;
  can_manage_video_chats?: boolean;
  can_post_stories?: boolean;
  can_edit_stories?: boolean;
  can_delete_stories?: boolean;
  is_anonymous?: boolean;
}

interface TelegramMyChatMemberUpdate {
  chat: TelegramChat;
  from: TelegramUser;
  date: number;
  old_chat_member: TelegramChatMember;
  new_chat_member: TelegramChatMember;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  my_chat_member?: TelegramMyChatMemberUpdate;
}

interface TelegramGetUpdatesResponse {
  ok: boolean;
  result: TelegramUpdate[];
}


export const notificationRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.CreateNotification, trackProps: ["provider"] })
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

      const limitedProviders = [
        "sms",
        "pagerduty",
        "opsgenie",
        "grafana-oncall",
        "whatsapp",
      ];
      if (limitedProviders.includes(props.provider)) {
        const isAllowed =
          opts.ctx.workspace.limits[
            props.provider as
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
            eq(notification.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .returning()
        .get();

      // TODO: relation

      if (monitors.length) {
        const allMonitors = await opts.ctx.db.query.monitor.findMany({
          where: and(
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            inArray(monitor.id, monitors),
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
          eq(notificationsToMonitors.notificationId, currentNotification.id),
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
              eq(
                notificationsToMonitors.notificationId,
                currentNotification.id,
              ),
            ),
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
            eq(notification.id, opts.input.id),
          ),
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
          eq(notification.workspaceId, opts.ctx.workspace.id),
        ),
        // FIXME: plural
        with: { monitor: { with: { monitor: true } } },
      });

      const schema = selectNotificationSchema.extend({
        monitor: z.array(
          z.object({
            monitor: selectMonitorSchema,
          }),
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
        }),
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
      console.log(opts.input);
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

      await db.transaction(async (tx) => {
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

  createTelegramToken: protectedProcedure.query(async (opts) => {
    const token = nanoid();
    await redis.set(`telegram:token:${token}`, opts.ctx.workspace.id, {
      ex: 259200, // 3 days
    });
    return { token };
  }),

  getTelegramUpdates: protectedProcedure
    .input(z.object({ privateChatId: z.string().optional() }).optional())
    .query(async (opts) => {
      const res = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`,
      );
      const data = (await res.json()) as TelegramGetUpdatesResponse;
      if (!data.ok || !data.result) return [];

      const privateChatId = opts.input?.privateChatId;
      const validUpdates: {
        chatId: string;
        chatType: "private" | "group";
        chatTitle?: string;
        user: { id: number; first_name: string; username?: string };
      }[] = [];

      for (const update of data.result) {
        // Phase 1: Look for private chat /start commands (no privateChatId filter)
        if (!privateChatId) {
          if (
            update.message?.chat.type === "private" &&
            update.message?.text?.startsWith("/start ")
          ) {
            const token = update.message.text.split(" ")[1];
            if (!token) continue;

            const workspaceId = await redis.get<string | number>(
              `telegram:token:${token}`,
            );
            if (workspaceId == opts.ctx.workspace.id) {
              await redis.expire(`telegram:token:${token}`, 10800);
              validUpdates.push({
                chatId: String(update.message.chat.id),
                chatType: "private",
                user: {
                  id: update.message.from.id,
                  first_name: update.message.from.first_name,
                  username: update.message.from.username,
                },
              });
            }
          }
        }
        // Phase 2: Look for group/supergroup additions filtered by privateChatId
        else {
          if (
            update.my_chat_member &&
            (update.my_chat_member.chat.type === "group" ||
              update.my_chat_member.chat.type === "supergroup") &&
            update.my_chat_member.old_chat_member.status === "left" &&
            (update.my_chat_member.new_chat_member.status === "member" ||
              update.my_chat_member.new_chat_member.status === "administrator") &&
            String(update.my_chat_member.from.id) === privateChatId
          ) {
            // Verify the token still exists for this workspace
            // We need to check if there's any valid token for this workspace
            // Since we don't have the token here, we'll trust that the privateChatId
            // was obtained from a valid token in Phase 1
            validUpdates.push({
              chatId: String(update.my_chat_member.chat.id),
              chatType: "group",
              chatTitle: update.my_chat_member.chat.title,
              user: {
                id: update.my_chat_member.from.id,
                first_name: update.my_chat_member.from.first_name,
                username: update.my_chat_member.from.username,
              },
            });
          }
        }
      }
      return validUpdates;
    }),
});
