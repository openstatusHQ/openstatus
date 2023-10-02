import { z } from "zod";

import { analytics, trackAnalytics } from "@openstatus/analytics";
import { and, eq } from "@openstatus/db";
import {
  allNotifications,
  insertNotificationSchema,
  notification,
  notificationsToMonitors,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { hasUserAccessToNotification, hasUserAccessToWorkspace } from "./utils";

export const notificationRouter = createTRPCRouter({
  createNotification: protectedProcedure
    .input(
      insertNotificationSchema.extend({
        workspaceSlug: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const { workspaceSlug, ...data } = opts.input;

      const result = await hasUserAccessToWorkspace({
        workspaceSlug,
        ctx: opts.ctx,
      });
      if (!result) return;

      const _notification = await opts.ctx.db
        .insert(notification)
        .values({ ...data, workspaceId: result.workspace.id })
        .returning()
        .get();

      await analytics.identify(result.user.id, {
        userId: result.user.id,
        email: result.user.email,
      });
      await trackAnalytics({
        event: "Notification Created",
        provider: _notification.provider,
      });

      return _notification;
    }),

  updateNotification: protectedProcedure
    .input(insertNotificationSchema)
    .mutation(async (opts) => {
      if (!opts.input.id) return;
      const result = await hasUserAccessToNotification({
        notificationId: opts.input.id,
        ctx: opts.ctx,
      });
      if (!result) return;

      const { ...data } = opts.input;
      return await opts.ctx.db
        .update(notification)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notification.id, opts.input.id))
        .returning()
        .get();
    }),

  deleteNotification: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      console.log({ id: opts.input.id });
      const result = await hasUserAccessToNotification({
        notificationId: opts.input.id,
        ctx: opts.ctx,
      });
      if (!result) return;

      await opts.ctx.db
        .delete(notification)
        .where(eq(notification.id, result.notification.id))
        .run();
    }),

  getNotificationById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      // if (!opts.input.id) return;
      // const result = await hasUserAccessToMonitor({
      //   monitorId: opts.input.id,
      //   ctx: opts.ctx,
      // });
      // if (!result) return;

      const _notification = await opts.ctx.db
        .select()
        .from(notification)
        .where(eq(notification.id, opts.input.id))
        .get();

      return selectNotificationSchema.parse(_notification);
    }),

  getNotificationsByWorkspace: protectedProcedure
    .input(z.object({ workspaceSlug: z.string() }))
    .query(async (opts) => {
      // Check if user has access to workspace
      const data = await hasUserAccessToWorkspace({
        workspaceSlug: opts.input.workspaceSlug,
        ctx: opts.ctx,
      });

      if (!data) return;

      const notifications = await opts.ctx.db
        .select()
        .from(notification)
        .where(eq(notification.workspaceId, data.workspace.id))
        .all();

      try {
        return allNotifications.parse(notifications);
      } catch (e) {
        console.log(e);
      }
      return;
    }),
});
