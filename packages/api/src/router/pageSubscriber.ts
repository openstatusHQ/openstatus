import { and, db, eq } from "@openstatus/db";
import {
  page,
  pageSubscriber,
  selectWorkspaceSchema,
} from "@openstatus/db/src/schema";
import {
  createSubscription,
  getSubscriptionByToken,
  hasPendingUnexpiredSubscription,
  sendTestWebhook,
  unsubscribe,
  updateChannel,
  updateSubscriptionScope,
  upsertEmailSubscription,
  verifySubscription,
} from "@openstatus/subscriptions";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const webhookHeadersSchema = z
  .array(
    z.object({
      key: z.string().min(1).max(256),
      value: z.string().max(4096),
    }),
  )
  .max(20)
  .optional();

async function assertPageInWorkspace(pageId: number, workspaceId: number) {
  const _page = await db.query.page.findFirst({
    where: and(eq(page.workspaceId, workspaceId), eq(page.id, pageId)),
    with: { workspace: true },
  });
  if (!_page) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
  }
  return _page;
}

function throwFromException(error: unknown, fallback: string): never {
  if (error instanceof TRPCError) throw error;
  // Log server-side so unexpected failures (DB constraint violations,
  // connection errors, etc.) show up in ops without us having to make
  // them part of the client contract.
  console.error("pageSubscriber router error:", error);
  if (error instanceof Error) {
    // Service-layer messages are intentionally safe to forward (no IDs,
    // no raw SQL). See packages/subscriptions/src/service.ts.
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallback });
}

/**
 * Reduce a webhook URL to its origin so the secret path isn't exposed.
 * Used when the row isn't owned by the vendor (self-signup / import).
 */
function webhookUrlForList(
  source: string,
  webhookUrl: string | null,
): string | null {
  if (!webhookUrl) return null;
  if (source === "vendor") return webhookUrl;
  try {
    return new URL(webhookUrl).origin;
  } catch {
    return null;
  }
}

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

        return subscriptions.map((sub) => {
          const isVendor = sub.source === "vendor";
          return {
            id: sub.id,
            channelType: sub.channelType,
            email: sub.email,
            // Vendor rows own the URL + config; other sources only expose the
            // origin (no credential-bearing path) and no channelConfig.
            webhookUrl: webhookUrlForList(sub.source, sub.webhookUrl),
            channelConfig: isVendor ? sub.channelConfig : null,
            source: sub.source,
            name: sub.name,
            acceptedAt: sub.acceptedAt,
            unsubscribedAt: sub.unsubscribedAt,
            createdAt: sub.createdAt,
            components: sub.components.map((c) => ({
              id: c.pageComponent.id,
              name: c.pageComponent.name,
            })),
            isEntirePage: sub.components.length === 0,
            pageId: sub.pageId,
          };
        });
      });

      return data;
    }),

  /**
   * PROTECTED: Create a vendor-added subscription (email or webhook).
   *
   * Skips the verification flow — partner starts receiving notifications
   * immediately. `token` is still generated so the partner can self-manage
   * via the existing `/manage/{token}` and `/unsubscribe/{token}` routes.
   */
  createSubscription: protectedProcedure
    .input(
      z.discriminatedUnion("channelType", [
        z.object({
          pageId: z.number().int().positive(),
          channelType: z.literal("email"),
          email: z.email(),
          name: z.string().max(255).nullish(),
          componentIds: z.array(z.number().int().positive()).optional(),
        }),
        z.object({
          pageId: z.number().int().positive(),
          channelType: z.literal("webhook"),
          webhookUrl: z.url(),
          name: z.string().max(255).nullish(),
          headers: webhookHeadersSchema,
          componentIds: z.array(z.number().int().positive()).optional(),
        }),
      ]),
    )
    .mutation(async (opts) => {
      const _page = await assertPageInWorkspace(
        opts.input.pageId,
        opts.ctx.workspace.id,
      );

      const workspace = selectWorkspaceSchema.safeParse(_page.workspace);
      if (!workspace.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Workspace data is invalid",
        });
      }
      if (!workspace.data.limits["status-subscribers"]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Upgrade to use status subscribers",
        });
      }

      try {
        if (opts.input.channelType === "email") {
          const sub = await createSubscription({
            pageId: opts.input.pageId,
            channelType: "email",
            email: opts.input.email,
            name: opts.input.name ?? null,
            componentIds: opts.input.componentIds,
          });
          return { success: true, id: sub.id };
        }

        const sub = await createSubscription({
          pageId: opts.input.pageId,
          channelType: "webhook",
          webhookUrl: opts.input.webhookUrl,
          name: opts.input.name ?? null,
          channelConfig: opts.input.headers
            ? { headers: opts.input.headers }
            : undefined,
          componentIds: opts.input.componentIds,
        });
        return { success: true, id: sub.id };
      } catch (error) {
        throwFromException(error, "Failed to create subscription");
      }
    }),

  /**
   * PROTECTED: Update a vendor-added subscription's channel config / scope.
   * Self-signup rows are rejected — they self-manage via token.
   */
  updateChannel: protectedProcedure
    .input(
      z.object({
        subscriberId: z.number().int().positive(),
        pageId: z.number().int().positive(),
        name: z.string().max(255).nullish(),
        webhookUrl: z.url().optional(),
        headers: webhookHeadersSchema,
        componentIds: z.array(z.number().int().positive()).optional(),
      }),
    )
    .mutation(async (opts) => {
      await assertPageInWorkspace(opts.input.pageId, opts.ctx.workspace.id);

      try {
        await updateChannel({
          subscriberId: opts.input.subscriberId,
          pageId: opts.input.pageId,
          name: opts.input.name === undefined ? undefined : opts.input.name,
          webhookUrl: opts.input.webhookUrl,
          channelConfig:
            opts.input.headers !== undefined
              ? { headers: opts.input.headers }
              : undefined,
          componentIds: opts.input.componentIds,
        });
        return { success: true };
      } catch (error) {
        throwFromException(error, "Failed to update subscription");
      }
    }),

  /**
   * PROTECTED: Send a test payload to a vendor-added webhook subscriber.
   */
  sendTestWebhook: protectedProcedure
    .input(
      z.object({
        subscriberId: z.number().int().positive(),
        pageId: z.number().int().positive(),
      }),
    )
    .mutation(async (opts) => {
      await assertPageInWorkspace(opts.input.pageId, opts.ctx.workspace.id);

      try {
        await sendTestWebhook(opts.input.subscriberId, opts.input.pageId);
        return { success: true };
      } catch (error) {
        throwFromException(error, "Failed to send test webhook");
      }
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
