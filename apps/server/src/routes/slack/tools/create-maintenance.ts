import { tool } from "ai";
import { z } from "zod";

export function createCreateMaintenanceTool() {
  return tool({
    description:
      "Schedule a maintenance window on a status page. Parse natural language dates into ISO 8601 format (e.g. 'next Friday 2-3 PM' -> proper ISO strings). The maintenance will be shown to the user for confirmation before publishing.",
    inputSchema: z.object({
      title: z.string().describe("Short title for the maintenance window"),
      message: z
        .string()
        .describe(
          "Professional maintenance message for the public status page",
        ),
      from: z
        .string()
        .describe("Start time in ISO 8601 format (e.g. 2025-03-14T14:00:00Z)"),
      to: z
        .string()
        .describe("End time in ISO 8601 format (e.g. 2025-03-14T15:00:00Z)"),
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
