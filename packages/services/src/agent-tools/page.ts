import { slugSchema } from "@openstatus/db/src/schema/pages/validation";
import { z } from "zod";

import { assertCreateBudget } from "../auth";
import { listPages, newPage } from "../page";
import type { AgentTool } from "./types";
import { dashboardUrl, statusPageUrl } from "./urls";

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
  scope: "pages:read",
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

const CreateStatusPageInputShape = z.object({
  title: z.string().trim().min(1).max(256).describe("Public page title."),
  slug: slugSchema.describe(
    "Subdomain of the public URL (<slug>.openstatus.dev): letters, digits and hyphens, at least 3 characters, unique across openstatus. Confirm it with the user.",
  ),
  description: z
    .string()
    .optional()
    .describe("Short public description shown under the title."),
});

const CreateStatusPageOutput = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  url: z.string(),
  dashboardUrl: z.string(),
});

export const createStatusPageTool: AgentTool<
  z.infer<typeof CreateStatusPageInputShape>,
  z.infer<typeof CreateStatusPageOutput>
> = {
  name: "create_status_page",
  description:
    "Create a public status page at https://<slug>.openstatus.dev with no components yet. AUDIT-LOGGED and counts against the plan's status page limit. Fails when the slug is taken. Add monitors to it with add_page_component. Custom domain, password/access control and theme are configured in the dashboard, not here.",
  scope: "pages:write",
  destructive: true,
  inputSchema: CreateStatusPageInputShape,
  outputSchema: CreateStatusPageOutput,
  approval: {
    summarize: (input) => ({
      title: `Create Status Page: ${input.title}`,
      lines: [
        { label: "Title", value: input.title },
        { label: "Slug", value: input.slug },
        ...(input.description
          ? [{ label: "Description", value: input.description }]
          : []),
      ],
    }),
    verb: "created",
  },
  async run({ ctx, input }) {
    await assertCreateBudget(ctx);
    const page = await newPage({
      ctx,
      input: {
        title: input.title,
        slug: input.slug,
        description: input.description,
      },
    });
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      url: statusPageUrl(page.slug),
      dashboardUrl: dashboardUrl(`/status-pages/${page.id}/components`),
    };
  },
};
