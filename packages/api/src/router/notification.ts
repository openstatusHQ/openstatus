import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  discordDataSchema,
  googleChatDataSchema,
  grafanaOncallDataSchema,
  notificationProvider,
  ntfyDataSchema,
  opsgenieDataSchema,
  pagerdutyDataSchema,
  slackDataSchema,
  telegramDataSchema,
  webhookDataSchema,
  whatsappDataSchema,
} from "@openstatus/db/src/schema";
import { NotFoundError } from "@openstatus/services";
import {
  NotificationDataInputSchema,
  createNotification,
  deleteNotification,
  listNotifications,
  updateNotification,
} from "@openstatus/services/notification";

import { Events } from "@openstatus/analytics";
import { SchemaError } from "@openstatus/error";
import { sendTestDiscordMessage as sendDiscordTest } from "@openstatus/notification-discord";
import { sendTest as sendGoogleChatTest } from "@openstatus/notification-google-chat";
import { sendTest as sendGrafanaTest } from "@openstatus/notification-grafana-oncall";
import { sendTest as sendNtfyTest } from "@openstatus/notification-ntfy";
import { sendTest as sendOpsGenieTest } from "@openstatus/notification-opsgenie";
import {
  PagerDutySchema,
  sendTest as sendPagerDutyTest,
} from "@openstatus/notification-pagerduty";
import { sendTestSlackMessage as sendSlackTest } from "@openstatus/notification-slack";
import { sendTest as sendTelegramTest } from "@openstatus/notification-telegram";
import { sendTest as sendWhatsAppTest } from "@openstatus/notification-twillio-whatsapp";
import { sendTest as sendWebhookTest } from "@openstatus/notification-webhook";
import { redis } from "@openstatus/upstash";
import { nanoid } from "nanoid";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import {
  type TelegramGetUpdatesResponse,
  processTelegramUpdates,
} from "../service/telegram-updates";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const notificationRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { items } = await listNotifications({
        ctx: toServiceCtx(ctx),
        input: {
          // Dashboard has no paging UI; match the sentinel pattern used
          // across the other domains.
          limit: 10_000,
          offset: 0,
          order: "desc",
        },
      });
      return items;
    } catch (err) {
      toTRPCError(err);
    }
  }),

  // TODO: rename to update after migration
  updateNotifier: protectedProcedure
    .meta({ track: Events.UpdateNotification })
    .input(
      z.object({
        id: z.number(),
        name: z.string(),
        data: NotificationDataInputSchema,
        monitors: z.array(z.number()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await updateNotification({
          ctx: toServiceCtx(ctx),
          input: {
            id: input.id,
            name: input.name,
            data: input.data,
            monitors: input.monitors,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  new: protectedProcedure
    .meta({ track: Events.CreateNotification, trackProps: ["provider"] })
    .input(
      z.object({
        provider: z.enum(notificationProvider),
        data: NotificationDataInputSchema,
        name: z.string(),
        monitors: z.array(z.number()).prefault([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createNotification({
          ctx: toServiceCtx(ctx),
          input: {
            name: input.name,
            provider: input.provider,
            data: input.data,
            monitors: input.monitors,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteNotification })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteNotification({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
      } catch (err) {
        // Preserve the pre-migration idempotent behaviour — the old tRPC
        // delete didn't throw on missing.
        if (err instanceof NotFoundError) return;
        toTRPCError(err);
      }
    }),

  sendTest: protectedProcedure
    .input(
      z.object({
        provider: z.enum(notificationProvider),
        data: NotificationDataInputSchema,
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
      if (opts.input.provider === "discord") {
        const _data = discordDataSchema.safeParse(opts.input.data);
        if (!_data.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: SchemaError.fromZod(_data.error, opts.input).message,
          });
        }

        await sendDiscordTest(_data.data.discord);
        return;
      }
      if (opts.input.provider === "slack") {
        const _data = slackDataSchema.safeParse(opts.input.data);
        if (!_data.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: SchemaError.fromZod(_data.error, opts.input).message,
          });
        }

        await sendSlackTest(_data.data.slack);
        return;
      }
      if (opts.input.provider === "webhook") {
        const _data = webhookDataSchema.safeParse(opts.input.data);
        if (!_data.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: SchemaError.fromZod(_data.error, opts.input).message,
          });
        }

        await sendWebhookTest({
          url: _data.data.webhook.endpoint,
          headers: _data.data.webhook.headers,
        });
        return;
      }
      if (opts.input.provider === "opsgenie") {
        const _data = opsgenieDataSchema.safeParse(opts.input.data);
        if (!_data.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: SchemaError.fromZod(_data.error, opts.input).message,
          });
        }

        await sendOpsGenieTest(_data.data.opsgenie);
        return;
      }
      if (opts.input.provider === "ntfy") {
        const _data = ntfyDataSchema.safeParse(opts.input.data);
        if (!_data.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: SchemaError.fromZod(_data.error, opts.input).message,
          });
        }

        await sendNtfyTest(_data.data.ntfy);
        return;
      }
      if (opts.input.provider === "pagerduty") {
        const _data = pagerdutyDataSchema.safeParse(opts.input.data);
        if (!_data.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: SchemaError.fromZod(_data.error, opts.input).message,
          });
        }

        let rawPagerduty: unknown;
        try {
          rawPagerduty = JSON.parse(_data.data.pagerduty);
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid PagerDuty configuration: malformed JSON",
          });
        }

        const parsed = PagerDutySchema.safeParse(rawPagerduty);
        if (!parsed.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid PagerDuty configuration",
          });
        }

        if (parsed.data.integration_keys.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No PagerDuty integration key provided",
          });
        }

        await sendPagerDutyTest({
          integrationKey: parsed.data.integration_keys[0].integration_key,
        });
        return;
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid provider",
      });
    }),

  createTelegramToken: protectedProcedure.query(async (opts) => {
    const workspaceId = opts.ctx.workspace.id;
    const randomId = nanoid(12);
    const EXPIRY = 1800; // 30 minutes

    await redis.set(`telegram:workspace_token:${workspaceId}`, randomId, {
      ex: EXPIRY,
    });

    return { token: randomId };
  }),

  getTelegramUpdates: protectedProcedure
    .input(
      z
        .object({
          privateChatId: z.string().optional(),
          since: z.number().optional(),
        })
        .optional(),
    )
    .query(async (opts) => {
      const res = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`,
      );
      const data = (await res.json()) as TelegramGetUpdatesResponse;
      if (!data.ok || !data.result) return [];

      const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
      if (!botUsername) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Telegram bot username not configured",
        });
      }

      return processTelegramUpdates({
        updates: data.result,
        workspaceId: opts.ctx.workspace.id,
        privateChatId: opts.input?.privateChatId,
        since: opts.input?.since,
        botUsername,
        redisClient: redis,
      });
    }),
});
