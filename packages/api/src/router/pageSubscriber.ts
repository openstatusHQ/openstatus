import { and, eq } from "@openstatus/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const pageSubscriberRouter = createTRPCRouter({
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
