import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq } from "@openstatus/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const pageSubscriberRouter = createTRPCRouter({
  getPageSubscribersByPageId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const _page = await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.workspaceId, opts.ctx.workspace.id),
          eq(page.id, opts.input.id),
        ),
      });

      if (!_page) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Unauthorized to get subscribers",
        });
      }

      const data = await opts.ctx.db.query.pageSubscriber.findMany({
        where: and(eq(pageSubscriber.pageId, _page.id)),
      });
      return data;
    }),

  unsubscribeById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const subscriber = await opts.ctx.db.query.pageSubscriber.findFirst({
        where: and(eq(pageSubscriber.id, opts.input.id)),
      });

      if (!subscriber) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscriber not found",
        });
      }

      const _page = await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.id, subscriber.pageId),
          eq(page.workspaceId, opts.ctx.workspace.id),
        ),
      });

      if (!_page) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Unauthorized to unsubscribe",
        });
      }

      return await opts.ctx.db
        .delete(pageSubscriber)
        .where(eq(pageSubscriber.id, subscriber.id));
    }),

  acceptSubscriberById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const subscriber = await opts.ctx.db.query.pageSubscriber.findFirst({
        where: and(eq(pageSubscriber.id, opts.input.id)),
      });

      if (!subscriber) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscriber not found",
        });
      }

      const _page = await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.id, subscriber.pageId),
          eq(page.workspaceId, opts.ctx.workspace.id),
        ),
      });

      if (!_page) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Unauthorized to unsubscribe",
        });
      }

      return await opts.ctx.db
        .update(pageSubscriber)
        .set({
          acceptedAt: new Date(),
        })
        .where(eq(pageSubscriber.id, subscriber.id));
    }),
});
