import { Events } from "@openstatus/analytics";
import {
  SAFE_SUBSCRIPTION_MESSAGES,
  createPageSubscriber,
  deletePageSubscriber,
  getSubscriberByToken,
  hasPendingSubscriber,
  listPageSubscribers,
  sendPageSubscriberTestWebhook,
  unsubscribeSubscriber,
  updatePageSubscriberChannel,
  updateSubscriberScope,
  upsertSelfSignupSubscriber,
  verifySelfSignupSubscriber,
} from "@openstatus/services/page-subscriber";
import { detectWebhookFlavor } from "@openstatus/subscriptions";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
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

const supportedWebhookUrlSchema = z
  .url()
  .refine((url) => detectWebhookFlavor(url) !== "generic", {
    message: "Only Slack and Discord webhook URLs are supported.",
  });

// Public (status-page-facing) procedures use the same allow-list as
// the protected procedures going through `toTRPCError`. Single source
// of truth lives in `@openstatus/services/page-subscriber` so a new
// subscriptions error message only needs adding in one place.
function throwFromException(error: unknown, fallback: string): never {
  if (error instanceof TRPCError) throw error;
  console.error("pageSubscriber router error:", error);
  if (error instanceof Error && SAFE_SUBSCRIPTION_MESSAGES.has(error.message)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallback });
}

export const pageSubscriberRouter = createTRPCRouter({
  /**
   * PUBLIC: Subscribe to a status page (or update existing subscription).
   * Lives outside the service layer — status-page self-signup is not
   * dashboard-owned.
   */
  upsert: publicProcedure
    .input(
      z.object({
        email: z.email(),
        pageId: z.number().int().positive(),
        componentIds: z.array(z.number().int().positive()).max(500).optional(),
      }),
    )
    .mutation(async (opts) => {
      const isPending = await hasPendingSubscriber({
        input: { email: opts.input.email, pageId: opts.input.pageId },
      });
      if (isPending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "A confirmation link was already sent. Please check your email or wait until it expires to request a new one.",
        });
      }

      try {
        const subscription = await upsertSelfSignupSubscriber({
          input: {
            email: opts.input.email,
            pageId: opts.input.pageId,
            componentIds: opts.input.componentIds,
          },
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
        throwFromException(error, "Failed to create subscription");
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
        const subscription = await verifySelfSignupSubscriber({
          input: { token: opts.input.token, domain: opts.input.domain },
        });

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
        throwFromException(error, "Failed to verify subscription");
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
      try {
        const subscription = await getSubscriberByToken({
          input: { token: opts.input.token, domain: opts.input.domain },
        });

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
      } catch (error) {
        throwFromException(error, "Failed to load subscription");
      }
    }),

  /**
   * PUBLIC: Update subscription scope (replace components)
   */
  updateScope: publicProcedure
    .input(
      z.object({
        token: z.string(),
        componentIds: z.array(z.number().int().positive()).max(500),
        domain: z.string().toLowerCase().optional(),
      }),
    )
    .mutation(async (opts) => {
      try {
        await updateSubscriberScope({
          input: {
            token: opts.input.token,
            componentIds: opts.input.componentIds,
            domain: opts.input.domain,
          },
        });

        return {
          success: true,
          subscription: {
            componentIds: opts.input.componentIds,
          },
        };
      } catch (error) {
        throwFromException(error, "Failed to update subscription scope");
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
        await unsubscribeSubscriber({
          input: { token: opts.input.token, domain: opts.input.domain },
        });
        return { success: true };
      } catch (error) {
        throwFromException(error, "Failed to unsubscribe");
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
    .query(async ({ ctx, input }) => {
      try {
        return await listPageSubscribers({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  /**
   * PROTECTED: Create a vendor-added subscription (email or webhook).
   */
  createSubscription: protectedProcedure
    .meta({ track: Events.SubscribePage })
    .input(
      z.discriminatedUnion("channelType", [
        z.object({
          pageId: z.number().int().positive(),
          channelType: z.literal("email"),
          email: z.email(),
          name: z.string().max(255).nullish(),
          componentIds: z
            .array(z.number().int().positive())
            .max(500)
            .optional(),
        }),
        z.object({
          pageId: z.number().int().positive(),
          channelType: z.literal("webhook"),
          webhookUrl: supportedWebhookUrlSchema,
          name: z.string().max(255).nullish(),
          headers: webhookHeadersSchema,
          componentIds: z
            .array(z.number().int().positive())
            .max(500)
            .optional(),
        }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id } = await createPageSubscriber({
          ctx: toServiceCtx(ctx),
          input,
        });
        return { success: true, id };
      } catch (err) {
        toTRPCError(err);
      }
    }),

  /**
   * PROTECTED: Update a vendor-added subscription's channel config / scope.
   */
  updateChannel: protectedProcedure
    .input(
      z.object({
        subscriberId: z.number().int().positive(),
        pageId: z.number().int().positive(),
        name: z.string().max(255).nullish(),
        webhookUrl: supportedWebhookUrlSchema.optional(),
        headers: webhookHeadersSchema,
        componentIds: z.array(z.number().int().positive()).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await updatePageSubscriberChannel({
          ctx: toServiceCtx(ctx),
          input,
        });
        return { success: true };
      } catch (err) {
        toTRPCError(err);
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
    .mutation(async ({ ctx, input }) => {
      try {
        await sendPageSubscriberTestWebhook({
          ctx: toServiceCtx(ctx),
          input,
        });
        return { success: true };
      } catch (err) {
        toTRPCError(err);
      }
    }),

  /**
   * PROTECTED: Delete a subscription (dashboard)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number(), pageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deletePageSubscriber({
          ctx: toServiceCtx(ctx),
          input,
        });
        return { success: true };
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
