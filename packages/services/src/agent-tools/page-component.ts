import { pageComponentTypes } from "@openstatus/db/src/schema";
import { z } from "zod";

import { assertCreateBudget } from "../auth";
import { createPageComponent, listPageComponents } from "../page-component";
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
  scope: "pages:read",
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

const AddPageComponentInputShape = z.object({
  pageId: z
    .number()
    .int()
    .describe("Status page to add to. Resolve via list_status_pages."),
  monitorId: z
    .number()
    .int()
    .describe("Monitor to show. Resolve via list_monitors."),
  name: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Public component name. Defaults to the monitor's name."),
  description: z.string().optional(),
});

const AddPageComponentOutput = z.object({
  id: z.number().int(),
  pageId: z.number().int(),
  monitorId: z.number().int(),
  name: z.string(),
  order: z.number().int(),
});

export const addPageComponentTool: AgentTool<
  z.infer<typeof AddPageComponentInputShape>,
  z.infer<typeof AddPageComponentOutput>
> = {
  name: "add_page_component",
  description:
    "Add a monitor to a status page as a component, appended after the existing ones. AUDIT-LOGGED and counts against the plan's component limit. pageId MUST come from list_status_pages and monitorId from list_monitors. A monitor can appear once per page; adding it again fails.",
  scope: "pages:write",
  destructive: true,
  inputSchema: AddPageComponentInputShape,
  outputSchema: AddPageComponentOutput,
  approval: {
    summarize: (input) => ({
      title: "Add Page Component",
      lines: [
        {
          label: "Page ID",
          value: String(input.pageId),
          ref: { kind: "page", pageId: input.pageId },
        },
        { label: "Monitor ID", value: String(input.monitorId) },
        ...(input.name ? [{ label: "Name", value: input.name }] : []),
      ],
    }),
    verb: "added",
  },
  async run({ ctx, input }) {
    await assertCreateBudget(ctx);
    const created = await createPageComponent({
      ctx,
      input: {
        pageId: input.pageId,
        type: "monitor",
        monitorId: input.monitorId,
        name: input.name,
        description: input.description,
      },
    });
    return {
      id: created.id,
      pageId: created.pageId,
      monitorId: created.monitorId ?? input.monitorId,
      name: created.name,
      order: created.order ?? 0,
    };
  },
};
