import { Events } from "@openstatus/analytics";
import { feedbackSource, feedbackType } from "@openstatus/db/src/schema";
import {
  hasSubmittedFeedback,
  submitFeedback,
} from "@openstatus/services/feedback";
import { z } from "zod";

import { env } from "../env";
import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const feedbackRouter = createTRPCRouter({
  // Lets one-time prompts ask only until the user has answered once.
  hasSubmitted: protectedProcedure
    .input(z.object({ source: z.enum(feedbackSource) }))
    .query(async ({ ctx, input }) => {
      try {
        return await hasSubmittedFeedback({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  submit: protectedProcedure
    .meta({
      track: Events.SubmitFeedback,
      trackProps: ["source", "type", "blocker"],
    })
    .input(
      z.object({
        message: z.string().trim().min(1, "Message required"),
        source: z.enum(feedbackSource),
        path: z.string(),
        isMobile: z.boolean().optional(),
        // NOTE: coming from ContactForm
        name: z.string().optional(),
        email: z.email().optional(),
        blocker: z.boolean().optional(),
        type: z.enum(feedbackType).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await submitFeedback({
          ctx: toServiceCtx(ctx),
          input: {
            message: input.message,
            source: input.source,
            path: input.path,
            type: input.type,
            blocker: input.blocker,
            metadata: {
              name: input.name,
              email: input.email,
              isMobile: input.isMobile,
              userAgent: ctx.metadata?.userAgent,
            },
          },
          slackWebhookUrl: env.SLACK_FEEDBACK_WEBHOOK_URL,
        });
      } catch (err) {
        toTRPCError(err);
      }

      return { success: true } as const;
    }),
});
