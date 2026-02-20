import { tool } from "ai";
import { z } from "zod";

export function createCreateStatusReportTool() {
  return tool({
    description:
      "Create a new status report. Draft the title and message based on the conversation. The report will be shown to the user for confirmation before publishing.",
    inputSchema: z.object({
      title: z.string().describe("Short title for the status report"),
      status: z
        .enum(["investigating", "identified", "monitoring", "resolved"])
        .describe("Current status of the incident"),
      message: z
        .string()
        .describe(
          "Professional status update message for the public status page",
        ),
      pageId: z.number().describe("ID of the status page to post on"),
      pageComponentIds: z
        .array(z.string())
        .optional()
        .describe("IDs of affected page components (optional)"),
    }),
    execute: async (input) => {
      return { needsConfirmation: true as const, params: input };
    },
  });
}
