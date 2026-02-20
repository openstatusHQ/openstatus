import { tool } from "ai";
import { z } from "zod";

export function createUpdateStatusReportTool() {
  return tool({
    description:
      "Edit a status report's metadata (title, components). This does NOT add a new update message — use addStatusReportUpdate for that. No subscriber notifications are sent.",
    inputSchema: z.object({
      statusReportId: z.number().describe("ID of the status report to edit"),
      title: z.string().optional().describe("New title for the report"),
      pageComponentIds: z
        .array(z.string())
        .optional()
        .describe("Updated list of affected component IDs"),
    }),
    execute: async (input) => {
      return { needsConfirmation: true as const, params: input };
    },
  });
}
