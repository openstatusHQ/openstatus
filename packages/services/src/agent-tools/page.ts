import { z } from "zod";

import { listPages } from "../page";
import type { AgentTool } from "./types";

const ListStatusPagesInput = z.object({}).strict();
const ListStatusPagesOutput = z.object({
  items: z.array(
    z.object({
      id: z.number().int(),
      title: z.string(),
      slug: z.string(),
    }),
  ),
});

export const listStatusPagesTool: AgentTool<
  z.infer<typeof ListStatusPagesInput>,
  z.infer<typeof ListStatusPagesOutput>
> = {
  name: "list_status_pages",
  description:
    "List status pages in this workspace with their slug and ids. Use to discover the pageId required by create_status_report and create_maintenance.",
  scope: "read",
  destructive: false,
  inputSchema: ListStatusPagesInput,
  outputSchema: ListStatusPagesOutput,
  async run({ ctx }) {
    const pages = await listPages({ ctx, input: { order: "desc" } });
    return {
      items: pages.map((p) => ({ id: p.id, title: p.title, slug: p.slug })),
    };
  },
};
