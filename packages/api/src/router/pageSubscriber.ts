import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { Events } from "@openstatus/analytics";
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
    .meta({ track: Events.SubscribePage })
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
          updatedAt: new Date(),
        })
        .where(eq(pageSubscriber.id, subscriber.id));
    }),

  // DASHBOARD

  list: protectedProcedure
    .input(
      z.object({
        pageId: z.number(),
        order: z.enum(["asc", "desc"]).optional(),
      }),
    )
    .query(async (opts) => {
      const data = await opts.ctx.db.transaction(async (tx) => {
        const _page = await tx.query.page.findFirst({
          where: and(
            eq(page.workspaceId, opts.ctx.workspace.id),
            eq(page.id, opts.input.pageId),
          ),
        });

        if (!_page) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Page not found",
          });
        }

        return await tx.query.pageSubscriber.findMany({
          where: eq(pageSubscriber.pageId, _page.id),
        });
      });

      return data;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number(), pageId: z.number() }))
    .mutation(async (opts) => {
      await opts.ctx.db.transaction(async (tx) => {
        const _page = await tx.query.page.findFirst({
          where: and(
            eq(page.workspaceId, opts.ctx.workspace.id),
            eq(page.id, opts.input.pageId),
          ),
        });

        if (!_page) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Page not found",
          });
        }

        const subscriber = await tx.query.pageSubscriber.findFirst({
          where: and(
            eq(pageSubscriber.id, opts.input.id),
            eq(pageSubscriber.pageId, opts.input.pageId),
          ),
        });

        if (!subscriber) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Subscriber not found",
          });
        }

        return await tx
          .delete(pageSubscriber)
          .where(eq(pageSubscriber.id, opts.input.id));
      });
    }),
});
