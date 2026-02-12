import { and, eq } from "@openstatus/db";
import { page, pageSubscription } from "@openstatus/db/src/schema";
import {
  getSubscriptionByToken,
  unsubscribe,
  updateSubscriptionScope,
  upsertEmailSubscription,
  verifySubscription,
} from "@openstatus/subscriptions";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

/**
 * Page Subscription Router
 * Handles multi-channel component-level subscriptions
 */
export const pageSubscriptionRouter = createTRPCRouter({
  /**
   * PUBLIC: Subscribe to a status page (or update existing subscription)
   * Used by public subscription forms on status pages
   */
  upsert: publicProcedure
    .input(
      z.object({
        email: z.email(),
        pageId: z.number().int().positive(),
        componentIds: z.array(z.number().int().positive()).optional(),
        groupId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async (opts) => {
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
            token: subscription.token,
            verifiedAt: subscription.verifiedAt,
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
   * Called when user clicks verification link in email
   */
  verify: publicProcedure
    .input(
      z.object({
        token: z.string(),
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
   * Used on /manage/[token] page
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
        verifiedAt: subscription.verifiedAt,
        unsubscribedAt: subscription.unsubscribedAt,
      };
    }),

  /**
   * PUBLIC: Update subscription scope (replace components)
   * Used on /manage/[token] page
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
   * Used on /manage/[token] page or unsubscribe links in emails
   */
  unsubscribe: publicProcedure
    .input(
      z.object({
        token: z.string().uuid(),
        domain: z.string().toLowerCase().optional(),
      }),
    )
    .mutation(async (opts) => {
      try {
        await unsubscribe(opts.input.token, opts.input.domain);

        return {
          success: true,
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
          message: "Failed to unsubscribe",
        });
      }
    }),

  /**
   * PROTECTED: List all subscriptions for a page (dashboard)
   * Used in dashboard subscribers management page
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
        // Verify page belongs to workspace
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

        // Get all subscriptions for this page with components
        const subscriptions = await tx.query.pageSubscription.findMany({
          where: eq(pageSubscription.pageId, _page.id),
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
          verifiedAt: sub.verifiedAt,
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
   * Permanently removes the subscription
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number(), pageId: z.number() }))
    .mutation(async (opts) => {
      await opts.ctx.db.transaction(async (tx) => {
        // Verify page belongs to workspace
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

        // Verify subscription exists and belongs to this page
        const subscription = await tx.query.pageSubscription.findFirst({
          where: and(
            eq(pageSubscription.id, opts.input.id),
            eq(pageSubscription.pageId, opts.input.pageId),
          ),
        });

        if (!subscription) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Subscription not found",
          });
        }

        // Delete subscription (CASCADE will handle junction table)
        return await tx
          .delete(pageSubscription)
          .where(eq(pageSubscription.id, opts.input.id));
      });

      return { success: true };
    }),
});
