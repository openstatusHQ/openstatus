import { z } from "zod";

import { and, eq } from "@openstatus/db";
import {
  insertNotificationSchema,
  notification,
  notificationsToMonitors,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { hasUserAccessToWorkspace } from "./utils";

export const notificationRouter = createTRPCRouter({
  createNotification: protectedProcedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        monitorId: z.number(),
        input: insertNotificationSchema,
      }),
    )
    .mutation(async (opts) => {
      const result = await hasUserAccessToWorkspace({
        workspaceSlug: opts.input.workspaceSlug,
        ctx: opts.ctx,
      });
      if (!result) return;

      //we might need to verify the data is correct

      const newData = await opts.ctx.db
        .insert(notification)
        .values({ ...opts.input.input, workspaceId: result.workspace.id })
        .returning()
        .get();

      await opts.ctx.db
        .insert(notificationsToMonitors)
        .values({
          monitorId: opts.input.monitorId,
          notificationId: newData.id,
        })
        .returning()
        .get();
    }),

  deleteNotification: protectedProcedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        monitorId: z.number(),
        notificationId: z.number(),
      }),
    )
    .mutation(async (opts) => {
      const result = await hasUserAccessToWorkspace({
        workspaceSlug: opts.input.workspaceSlug,
        ctx: opts.ctx,
      });
      if (!result) return;
      // We might need to verify the data is correct before inserting
      await opts.ctx.db
        .delete(notificationsToMonitors)
        .where(
          and(
            eq(notificationsToMonitors.monitorId, opts.input.monitorId),
            eq(
              notificationsToMonitors.notificationId,
              opts.input.notificationId,
            ),
          ),
        )
        .run();
      await opts.ctx.db
        .delete(notification)
        .where(eq(notification.id, opts.input.notificationId))
        .run();
    }),
});
