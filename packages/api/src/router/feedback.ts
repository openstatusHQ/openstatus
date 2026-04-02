import {
  feedback,
  feedbackSource,
  feedbackType,
} from "@openstatus/db/src/schema";
import { z } from "zod";
import { env } from "../env";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const feedbackRouter = createTRPCRouter({
  submit: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1, "Message required"),
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
    .mutation(async (opts) => {
      // Persist to database
      await opts.ctx.db.insert(feedback).values({
        workspaceId: opts.ctx.workspace.id,
        userId: opts.ctx.user.id,
        source: opts.input.source,
        message: opts.input.message,
        type: opts.input.type,
        blocker: opts.input.blocker,
        path: opts.input.path,
        metadata: JSON.stringify({
          isMobile: opts.input.isMobile,
          userAgent: opts.ctx.metadata?.userAgent,
        }),
      });

      // Send to Slack
      if (!env.SLACK_FEEDBACK_WEBHOOK_URL) {
        console.error("Slack feedback webhook not configured.");
        return { success: true } as const;
      }

      if (process.env.NODE_ENV === "development") {
        console.log("feedback.submit", opts.input);
        return { success: true } as const;
      }

      const textLines: string[] = [];
      textLines.push(`*Source:* ${opts.input.source}`);
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

      textLines.push("--------------------------------");

      textLines.push(`*Message:* ${opts.input.message}`);

      try {
        await fetch(env.SLACK_FEEDBACK_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: textLines.join("\n"),
          }),
        });
      } catch (err) {
        console.error("Failed to send feedback to Slack", err);
      }

      return { success: true } as const;
    }),
});
