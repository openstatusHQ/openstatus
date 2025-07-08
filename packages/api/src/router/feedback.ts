import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "../env";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const feedbackRouter = createTRPCRouter({
  submit: publicProcedure
    .input(
      z.object({
        message: z.string().min(1, "Message required"),
      })
    )
    .mutation(async (opts) => {
      if (!env.SLACK_FEEDBACK_WEBHOOK_URL) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Slack feedback webhook not configured.",
        });
      }

      const textLines: string[] = [];
      if (opts.ctx.user) textLines.push(`*Email:* ${opts.ctx.user.email}`);
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
