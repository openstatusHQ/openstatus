import { feedbackSource, feedbackType } from "@openstatus/db/src/schema";
import { z } from "zod";

export const SubmitFeedbackInput = z.object({
  message: z.string().trim().min(1, "Message required"),
  source: z.enum(feedbackSource),
  path: z.string(),
  type: z.enum(feedbackType).optional(),
  blocker: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackInput>;

export const HasSubmittedFeedbackInput = z.object({
  source: z.enum(feedbackSource),
});
export type HasSubmittedFeedbackInput = z.infer<
  typeof HasSubmittedFeedbackInput
>;
