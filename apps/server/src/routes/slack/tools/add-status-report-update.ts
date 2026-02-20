import { tool } from "ai";
import { z } from "zod";

export function createAddStatusReportUpdateTool() {
  return tool({
    description:
      "Add a progress update to an existing status report. This creates a new update entry and changes the report's status. Use for progress updates and resolving incidents.",
    inputSchema: z.object({
      statusReportId: z.number().describe("ID of the status report to update"),
      status: z
        .enum(["investigating", "identified", "monitoring", "resolved"])
        .describe("New status for the report"),
      message: z
        .string()
        .describe("Professional update message for the public status page"),
    }),
    execute: async (input) => {
      return { needsConfirmation: true as const, params: input };
    },
  });
}
