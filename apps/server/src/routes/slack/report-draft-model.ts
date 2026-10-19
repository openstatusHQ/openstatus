import { generateText, Output } from "ai";
import { z } from "zod";

import { SLACK_DRAFT_MODEL } from "./model";

export const modelDraftSchema = z.object({
  pageId: z.number().int().nullable(),
  componentIds: z.array(z.number().int()),
  impact: z.enum(["degraded_performance", "partial_outage", "major_outage"]),
  message: z.string().trim().min(1),
  startedAt: z
    .string()
    .nullable()
    .describe("ISO 8601 UTC time the problem began, if the messages show it."),
  startedAtSource: z
    .string()
    .nullable()
    .describe(
      "Where that time comes from in a few plain words, e.g. 'first error report in the channel'. No mentions or links.",
    ),
});

export type ModelDraft = z.infer<typeof modelDraftSchema>;

const DRAFT_TIMEOUT_MS = 20_000;

export async function generateReportDraft(args: {
  system: string;
  prompt: string;
}): Promise<ModelDraft> {
  const result = await generateText({
    model: SLACK_DRAFT_MODEL,
    system: args.system,
    prompt: args.prompt,
    output: Output.object({ schema: modelDraftSchema }),
    abortSignal: AbortSignal.timeout(DRAFT_TIMEOUT_MS),
  });
  return result.output;
}
