import { and, eq } from "@openstatus/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";
import {
  getSubscriptionByToken,
  hasPendingUnexpiredSubscription,
  unsubscribe,
  updateSubscriptionScope,
  upsertEmailSubscription,
  verifySubscription,
} from "@openstatus/subscriptions";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const pageSubscriberRouter = createTRPCRouter({
  /**
   * PUBLIC: Subscribe to a status page (or update existing subscription)
   */
  upsert: publicProcedure
    .input(
      z.object({
        email: z.email(),
        pageId: z.number().int().positive(),
        componentIds: z.array(z.number().int().positive()).optional(),
      }),
    )
    .mutation(async (opts) => {
      // Guard against email spam: reject if a pending (unverified, unexpired) subscription exists
      const isPending = await hasPendingUnexpiredSubscription(
        opts.input.email,
        opts.input.pageId,
      );
      if (isPending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "A confirmation link was already sent. Please check your email or wait until it expires to request a new one.",
        });
      }

      try {
        const subscription = await upsertEmailSubscription({
          email: opts.input.email,
          pageId: opts.input.pageId,
          componentIds: opts.input.componentIds,
        });

        return {
          success: true,
          subscription: {
            id: subscription.id,
            acceptedAt: subscription.acceptedAt,
            componentIds: subscription.componentIds,
          },
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to create subscription",
        });
      }
    }),

  /**
   * PUBLIC: Verify email subscription by token
   */
  verify: publicProcedure
    .input(
      z.object({
        token: z.uuid(),
        domain: z.string().toLowerCase().optional(),
      }),
    )
    .mutation(async (opts) => {
      try {
        const subscription = await verifySubscription(
          opts.input.token,
          opts.input.domain,
        );

        if (!subscription) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Subscription not found or token invalid",
          });
        }

        return {
          success: true,
          subscription: {
            id: subscription.id,
            email: subscription.email,
            pageSlug: subscription.pageSlug,
            pageName: subscription.pageName,
            componentIds: subscription.componentIds,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to verify subscription",
        });
      }
    }),

  /**
   * PUBLIC: Get subscription by token (for management UI)
   */
  getByToken: publicProcedure
    .input(
      z.object({
        token: z.string(),
        domain: z.string().toLowerCase().optional(),
      }),
    )
    .query(async (opts) => {
      const subscription = await getSubscriptionByToken(
        opts.input.token,
        opts.input.domain,
      );

      if (!subscription) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscription not found",
        });
      }

      return {
        id: subscription.id,
        email: subscription.email,
        pageName: subscription.pageName,
        pageSlug: subscription.pageSlug,
        customDomain: subscription.customDomain,
        channelType: subscription.channelType,
        componentIds: subscription.componentIds,
        acceptedAt: subscription.acceptedAt,
        unsubscribedAt: subscription.unsubscribedAt,
      };
    }),

  /**
   * PUBLIC: Update subscription scope (replace components)
   */
  updateScope: publicProcedure
    .input(
      z.object({
        token: z.string(),
        componentIds: z.array(z.number().int().positive()),
        domain: z.string().toLowerCase().optional(),
      }),
    )
    .mutation(async (opts) => {
      try {
        const subscription = await updateSubscriptionScope({
          token: opts.input.token,
          componentIds: opts.input.componentIds,
          domain: opts.input.domain,
        });

        return {
          success: true,
          subscription: {
            id: subscription.id,
            componentIds: subscription.componentIds,
          },
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to update subscription scope",
        });
      }
    }),

  /**
   * PUBLIC: Unsubscribe by token
   */
  unsubscribe: publicProcedure
    .input(
      z.object({
        token: z.string(),
        domain: z.string().toLowerCase().optional(),
      }),
    )
    .mutation(async (opts) => {
      try {
        await unsubscribe(opts.input.token, opts.input.domain);

        return { success: true };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to unsubscribe",
        });
      }
    }),

  /**
   * PROTECTED: List all subscriptions for a page (dashboard)
   */
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

        const subscriptions = await tx.query.pageSubscriber.findMany({
          where: eq(pageSubscriber.pageId, _page.id),
          with: {
            components: {
              with: {
                pageComponent: true,
              },
            },
          },
          orderBy: (subs, { desc, asc }) =>
            opts.input.order === "asc"
              ? asc(subs.createdAt)
              : desc(subs.createdAt),
        });

        return subscriptions.map((sub) => ({
          id: sub.id,
          channelType: sub.channelType,
          email: sub.email,
          webhookUrl: sub.webhookUrl,
          acceptedAt: sub.acceptedAt,
          unsubscribedAt: sub.unsubscribedAt,
          createdAt: sub.createdAt,
          components: sub.components.map((c) => ({
            id: c.pageComponent.id,
            name: c.pageComponent.name,
          })),
          isEntirePage: sub.components.length === 0,
          pageId: sub.pageId,
        }));
      });

      return data;
    }),

  /**
   * PROTECTED: Delete a subscription (dashboard)
   */
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

      return { success: true };
    }),
});
