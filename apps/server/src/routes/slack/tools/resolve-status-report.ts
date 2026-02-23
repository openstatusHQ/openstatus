import { tool } from "ai";
import { z } from "zod";

export function createResolveStatusReportTool() {
  return tool({
    description:
      "Resolve an active status report. This marks the incident as resolved and adds a final update message to the public status page.",
    inputSchema: z.object({
      statusReportId: z.number().describe("ID of the status report to resolve"),
      message: z
        .string()
        .describe(
          "Resolution message explaining what was fixed, for the public status page",
        ),
    }),
    execute: async (input) => {
      return { needsConfirmation: true as const, params: input };
    },
  });
}
