import { z } from "zod";

import { assertCreateBudget } from "../auth";
import {
  createPageComponentGroup,
  updatePageComponentGroup,
} from "../page-component-group";
import type { AgentTool } from "./types";

const ComponentGroupOutput = z.object({
  id: z.number().int(),
  pageId: z.number().int(),
  name: z.string(),
  defaultOpen: z.boolean(),
});

const CreateComponentGroupInputShape = z.object({
  pageId: z
    .number()
    .int()
    .describe(
      "Status page to add the group to. Resolve via list_status_pages.",
    ),
  name: z.string().trim().min(1).describe("Public group heading."),
  defaultOpen: z
    .boolean()
    .optional()
    .describe("Whether the group starts expanded on the page (default false)."),
});

export const createComponentGroupTool: AgentTool<
  z.infer<typeof CreateComponentGroupInputShape>,
  z.infer<typeof ComponentGroupOutput>
> = {
  name: "create_component_group",
  description:
    "Create an empty component group on a status page, shown as a collapsible heading. AUDIT-LOGGED. pageId MUST come from list_status_pages. Move components into it with update_page_component({ componentId, groupId }). Check list_page_components `groups` first and reuse a group with the same name instead of creating a duplicate.",
  scope: "pages:write",
  destructive: true,
  inputSchema: CreateComponentGroupInputShape,
  outputSchema: ComponentGroupOutput,
  approval: {
    summarize: (input) => ({
      title: `Create Component Group: ${input.name}`,
      lines: [
        {
          label: "Page ID",
          value: String(input.pageId),
          ref: { kind: "page", pageId: input.pageId },
        },
        { label: "Name", value: input.name },
        { label: "Default open", value: input.defaultOpen ? "yes" : "no" },
      ],
    }),
    verb: "created",
  },
  async run({ ctx, input }) {
    await assertCreateBudget(ctx);
    const created = await createPageComponentGroup({
      ctx,
      input: {
        pageId: input.pageId,
        name: input.name,
        defaultOpen: input.defaultOpen,
      },
    });
    return {
      id: created.id,
      pageId: created.pageId,
      name: created.name,
      defaultOpen: created.defaultOpen,
    };
  },
};

const UpdateComponentGroupInputShape = z
  .object({
    groupId: z
      .number()
      .int()
      .describe(
        "Component group id. Resolve via list_page_components `groups` — never guess.",
      ),
    name: z.string().trim().min(1).optional(),
    defaultOpen: z.boolean().optional(),
  })
  .refine(
    (input) => input.name !== undefined || input.defaultOpen !== undefined,
    { message: "Send name or defaultOpen." },
  );

export const updateComponentGroupTool: AgentTool<
  z.infer<typeof UpdateComponentGroupInputShape>,
  z.infer<typeof ComponentGroupOutput>
> = {
  name: "update_component_group",
  description:
    "Rename a component group or change whether it starts expanded. AUDIT-LOGGED. groupId MUST come from list_page_components. To move components between groups use update_page_component.",
  scope: "pages:write",
  destructive: true,
  inputSchema: UpdateComponentGroupInputShape,
  outputSchema: ComponentGroupOutput,
  approval: {
    summarize: (input) => ({
      title: `Update Component Group #${input.groupId}`,
      lines: [
        { label: "Group ID", value: String(input.groupId) },
        ...(input.name !== undefined
          ? [{ label: "Name", value: input.name }]
          : []),
        ...(input.defaultOpen !== undefined
          ? [{ label: "Default open", value: input.defaultOpen ? "yes" : "no" }]
          : []),
      ],
    }),
    verb: "updated",
  },
  async run({ ctx, input }) {
    const updated = await updatePageComponentGroup({
      ctx,
      input: {
        id: input.groupId,
        name: input.name,
        defaultOpen: input.defaultOpen,
      },
    });
    return {
      id: updated.id,
      pageId: updated.pageId,
      name: updated.name,
      defaultOpen: updated.defaultOpen,
    };
  },
};
