import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import { listPages } from "@openstatus/services/page";
import { z } from "zod";

import { runTool } from "../adapter";

// Pages carry secrets (`password`, `customDomain` access controls) that
// must never reach an LLM client. Output is a deliberately slim shape
// — see mcp-plan.md §"Schemas".
//
// No `limit` input: pages are low-cardinality (workspaces have a
// handful), and `listPages` doesn't support `limit` push-down. A
// client-side slice would lie about the cap. Add real pagination if a
// workspace ever hits a problematic page count.

export function registerPageTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  const registered = new Map<string, RegisteredTool>();

  registered.set(
    "list_status_pages",
    server.registerTool(
      "list_status_pages",
      {
        description:
          "List status pages in this workspace with their slug and ids. Use to discover the pageId required by create_status_report and create_maintenance.",
        annotations: { readOnlyHint: true, openWorldHint: false },
        inputSchema: {},
        outputSchema: {
          items: z.array(
            z.object({
              id: z.number().int(),
              title: z.string(),
              slug: z.string(),
            }),
          ),
        },
      },
      async () =>
        runTool(
          () => listPages({ ctx, input: { order: "desc" } }),
          (pages) => {
            const items = pages.map((p) => ({
              id: p.id,
              title: p.title,
              slug: p.slug,
            }));
            return {
              content: [{ type: "text", text: JSON.stringify({ items }) }],
              structuredContent: { items },
            };
          },
        ),
    ),
  );

  return registered;
}
