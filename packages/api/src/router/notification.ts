import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq } from "@openstatus/db";
import {
  NotificationDataSchema,
  insertNotificationSchema,
  notification,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";
import { getLimit } from "@openstatus/plans";

import { SchemaError } from "@openstatus/error";
import { trackNewNotification } from "../analytics";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { env } from "../env";

export const notificationRouter = createTRPCRouter({
  create: protectedProcedure
    .input(insertNotificationSchema)
    .mutation(async (opts) => {
      const { ...props } = opts.input;

      const notificationLimit = getLimit(
        opts.ctx.workspace.plan,
        "notification-channels"
      );

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

      if (env.JITSU_HOST !== undefined && env.JITSU_WRITE_KEY !== undefined) {
        await trackNewNotification(opts.ctx.user, {
          provider: _notification.provider,
        });
      }

      return _notification;
    }),

  update: protectedProcedure
    .input(insertNotificationSchema)
    .mutation(async (opts) => {
      if (!opts.input.id) return;

      const { ...props } = opts.input;

      const _data = NotificationDataSchema.safeParse(JSON.parse(props.data));

      if (!_data.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: SchemaError.fromZod(_data.error, props).message,
        });
      }

      return await opts.ctx.db
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
    }),

  deleteNotification: protectedProcedure
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
      const _notification = await opts.ctx.db
        .select()
        .from(notification)
        .where(
          and(
            eq(notification.id, opts.input.id),
            eq(notification.id, opts.input.id),
            eq(notification.workspaceId, opts.ctx.workspace.id)
          )
        )
        .get();

      return selectNotificationSchema.parse(_notification);
    }),

  getNotificationsByWorkspace: protectedProcedure.query(async (opts) => {
    const notifications = await opts.ctx.db
      .select()
      .from(notification)
      .where(eq(notification.workspaceId, opts.ctx.workspace.id))
      .all();

    return z.array(selectNotificationSchema).parse(notifications);
  }),

  isNotificationLimitReached: protectedProcedure.query(async (opts) => {
    const notificationLimit = getLimit(
      opts.ctx.workspace.plan,
      "notification-channels"
    );
    const notificationNumbers = (
      await opts.ctx.db.query.notification.findMany({
        where: eq(notification.workspaceId, opts.ctx.workspace.id),
      })
    ).length;

    return notificationNumbers >= notificationLimit;
  }),
});
