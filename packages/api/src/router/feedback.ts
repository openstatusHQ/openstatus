import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "../env";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const feedbackRouter = createTRPCRouter({
  submit: protectedProcedure
    .input(
      z.object({
        // NOTE: coming from NavFeedback
        message: z.string().min(1, "Message required"),
        path: z.string().optional(),
        isMobile: z.boolean().optional(),
        // NOTE: coming from ContactForm
        name: z.string().optional(),
        email: z.string().email().optional(),
        blocker: z.boolean().optional(),
        type: z.string().optional(),
      }),
    )
    .mutation(async (opts) => {
      if (!env.SLACK_FEEDBACK_WEBHOOK_URL) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Slack feedback webhook not configured.",
        });
      }

      const textLines: string[] = [];
      if (opts.input.name) textLines.push(`*Name:* ${opts.input.name}`);
      if (opts.input.email) textLines.push(`*Email:* ${opts.input.email}`);
      if (opts.input.blocker)
        textLines.push(`*Blocker:* ${opts.input.blocker}`);
      if (opts.input.type) textLines.push(`*Type:* ${opts.input.type}`);
      if (opts.ctx.user) textLines.push(`*User:* ${opts.ctx.user.email}`);
      if (opts.input.path) textLines.push(`*Path:* ${opts.input.path}`);
      if (opts.input.isMobile)
        textLines.push(`*Mobile:* ${opts.input.isMobile}`);
      if (opts.ctx.metadata?.userAgent)
        textLines.push(`*User Agent:* ${opts.ctx.metadata.userAgent}`);
      if (opts.ctx.metadata?.location)
        textLines.push(`*Location:* ${opts.ctx.metadata.location}`);

      textLines.push("--------------------------------");

      textLines.push(`*Message:* ${opts.input.message}`);

      await fetch(env.SLACK_FEEDBACK_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: textLines.join("\n"),
        }),
      });

      return { success: true } as const;
    }),
});
