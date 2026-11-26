import { Events } from "@openstatus/analytics";
import {
  createPageSubscriber,
  deletePageSubscriber,
  listPageSubscribers,
  sendPageSubscriberTestWebhook,
  updatePageSubscriberChannel,
} from "@openstatus/services/page-subscriber";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const webhookHeadersSchema = z
  .array(
    z.object({
      key: z.string().min(1).max(256),
      value: z.string().max(4096),
    }),
  )
  .max(20)
  .optional();

const supportedWebhookUrlSchema = z.url();

export const pageSubscriberRouter = createTRPCRouter({
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
