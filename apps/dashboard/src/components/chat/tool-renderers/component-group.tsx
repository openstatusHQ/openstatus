import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

export function createComponentGroupChanges(
  input: AgentToolInput<"create_component_group">,
  applied?: AgentToolOutput<"create_component_group">,
): ChangeRow[] {
  return [
    ...(applied ? [{ field: "id", after: applied.id }] : []),
    { field: "pageId", after: input.pageId },
    { field: "name", after: input.name },
    {
      field: "defaultOpen",
      after: applied?.defaultOpen ?? input.defaultOpen ?? false,
    },
  ];
}

export function updateComponentGroupChanges(
  input: AgentToolInput<"update_component_group">,
): ChangeRow[] {
  return [
    { field: "groupId", after: input.groupId },
    ...(input.name !== undefined ? [{ field: "name", after: input.name }] : []),
    ...(input.defaultOpen !== undefined
      ? [{ field: "defaultOpen", after: input.defaultOpen }]
      : []),
  ];
}
