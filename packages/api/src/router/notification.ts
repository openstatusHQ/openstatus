import { z } from "zod";

import { and, eq } from "@openstatus/db";
import {
  insertNotificationSchema,
  notification,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";

import { trackNewNotification } from "../analytics";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const notificationRouter = createTRPCRouter({
  create: protectedProcedure
    .input(insertNotificationSchema)
    .mutation(async (opts) => {
      const { ...data } = opts.input;

      const _notification = await opts.ctx.db
        .insert(notification)
        .values({ ...data, workspaceId: opts.ctx.workspace.id })
        .returning()
        .get();

      await trackNewNotification(opts.ctx.user, {
        provider: _notification.provider,
      });

      return _notification;
    }),

  update: protectedProcedure
    .input(insertNotificationSchema)
    .mutation(async (opts) => {
      if (!opts.input.id) return;

      const { ...data } = opts.input;
      return await opts.ctx.db
        .update(notification)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(notification.id, opts.input.id),
            eq(notification.workspaceId, opts.ctx.workspace.id),
          ),
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
            eq(notification.id, opts.input.id),
          ),
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
          ),
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
});
