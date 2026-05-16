import { pageComponentTypes } from "@openstatus/db/src/schema";
import { z } from "zod";

import { listPageComponents } from "../page-component";
import type { AgentTool } from "./types";

const ListPageComponentsInputShape = z.object({
  pageId: z
    .number()
    .int()
    .optional()
    .describe(
      "If set, only components belonging to this page. Resolve via list_status_pages.",
    ),
});

const ListPageComponentsOutput = z.object({
  items: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      type: z.enum(pageComponentTypes),
      pageId: z.number().int(),
      monitorId: z.number().int().nullable(),
    }),
  ),
});

export const listPageComponentsTool: AgentTool<
  z.infer<typeof ListPageComponentsInputShape>,
  z.infer<typeof ListPageComponentsOutput>
> = {
  name: "list_page_components",
  description:
    "List page components in this workspace with their id, name, type ('monitor' or 'static'), pageId and linked monitorId. Use to discover the pageComponentIds required by create_status_report, create_maintenance, and update_status_report — those tools reject ids that don't belong to the workspace/page.",
  scope: "read",
  destructive: false,
  inputSchema: ListPageComponentsInputShape,
  outputSchema: ListPageComponentsOutput,
  async run({ ctx, input }) {
    const components = await listPageComponents({
      ctx,
      input: { pageId: input.pageId, order: "asc" },
    });
    return {
      items: components.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        pageId: c.pageId,
        monitorId: c.monitorId ?? null,
      })),
    };
  },
};
