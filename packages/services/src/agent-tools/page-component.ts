import { pageComponentTypes } from "@openstatus/db/src/schema";
import { z } from "zod";

import { assertCreateBudget } from "../auth";
import {
  createPageComponent,
  listPageComponents,
  updatePageComponent,
} from "../page-component";
import { listPageComponentGroups } from "../page-component-group";
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
      groupId: z.number().int().nullable(),
      groupName: z.string().nullable(),
    }),
  ),
  groups: z.array(
    z.object({
      id: z.number().int(),
      pageId: z.number().int(),
      name: z.string(),
      defaultOpen: z.boolean(),
    }),
  ),
});

export const listPageComponentsTool: AgentTool<
  z.infer<typeof ListPageComponentsInputShape>,
  z.infer<typeof ListPageComponentsOutput>
> = {
  name: "list_page_components",
  description:
    "List page components in this workspace with their id, name, type ('monitor' or 'static'), pageId, linked monitorId and group, plus the component groups of those pages (`groups`, including empty ones). Use to discover the pageComponentIds required by create_status_report, create_maintenance, and update_status_report — those tools reject ids that don't belong to the workspace/page — and the groupId for update_page_component / update_component_group.",
  scope: "pages:read",
  destructive: false,
  inputSchema: ListPageComponentsInputShape,
  outputSchema: ListPageComponentsOutput,
  async run({ ctx, input }) {
    const [components, groups] = await Promise.all([
      listPageComponents({
        ctx,
        input: { pageId: input.pageId, order: "asc" },
      }),
      listPageComponentGroups({ ctx, input: { pageId: input.pageId } }),
    ]);
    return {
      items: components.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        pageId: c.pageId,
        monitorId: c.monitorId ?? null,
        groupId: c.groupId ?? null,
        groupName: c.group?.name ?? null,
      })),
      groups: groups.map((g) => ({
        id: g.id,
        pageId: g.pageId,
        name: g.name,
        defaultOpen: g.defaultOpen,
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

const UpdatePageComponentInputShape = z
  .object({
    componentId: z
      .number()
      .int()
      .describe(
        "Page component id. Resolve via list_page_components — never guess.",
      ),
    name: z.string().trim().min(1).optional().describe("Public name."),
    description: z.string().optional(),
    order: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Position on the page, 0-based."),
    groupId: z
      .number()
      .int()
      .nullable()
      .optional()
      .describe(
        "Group to move the component into (must be on the same page; ids from list_page_components `groups`). null removes it from its group.",
      ),
  })
  .refine(
    (input) => Object.values(input).filter((v) => v !== undefined).length > 1,
    { message: "Send at least one field to change besides componentId." },
  );

const UpdatePageComponentOutput = z.object({
  id: z.number().int(),
  pageId: z.number().int(),
  monitorId: z.number().int().nullable(),
  name: z.string(),
  order: z.number().int(),
  groupId: z.number().int().nullable(),
});

export const updatePageComponentTool: AgentTool<
  z.infer<typeof UpdatePageComponentInputShape>,
  z.infer<typeof UpdatePageComponentOutput>
> = {
  name: "update_page_component",
  description:
    "Rename, reorder, describe or regroup a status page component. AUDIT-LOGGED. Call list_page_components first and send only the fields that change. groupId moves the component into a group on the same page (create one with create_component_group); null ungroups it. The linked monitor cannot change — add a new component instead.",
  scope: "pages:write",
  destructive: true,
  inputSchema: UpdatePageComponentInputShape,
  outputSchema: UpdatePageComponentOutput,
  approval: {
    summarize: (input) => ({
      title: `Update Page Component #${input.componentId}`,
      lines: [
        {
          label: "Component ID",
          value: String(input.componentId),
          ref: { kind: "components", componentIds: [input.componentId] },
        },
        ...(input.name !== undefined
          ? [{ label: "Name", value: input.name }]
          : []),
        ...(input.description !== undefined
          ? [{ label: "Description", value: input.description || "(cleared)" }]
          : []),
        ...(input.order !== undefined
          ? [{ label: "Order", value: String(input.order) }]
          : []),
        ...(input.groupId !== undefined
          ? [
              {
                label: "Group ID",
                value:
                  input.groupId === null ? "(ungroup)" : String(input.groupId),
              },
            ]
          : []),
      ],
    }),
    verb: "updated",
  },
  async run({ ctx, input }) {
    const updated = await updatePageComponent({
      ctx,
      input: {
        id: input.componentId,
        name: input.name,
        description: input.description,
        order: input.order,
        groupId: input.groupId,
      },
    });
    return {
      id: updated.id,
      pageId: updated.pageId,
      monitorId: updated.monitorId ?? null,
      name: updated.name,
      order: updated.order ?? 0,
      groupId: updated.groupId ?? null,
    };
  },
};
