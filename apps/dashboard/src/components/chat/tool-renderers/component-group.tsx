import type {
  AgentToolInput,
  AgentToolOutput,
  ApprovalBefore,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

import { fieldChanges, idRow } from "./before-diff";

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
  before?: ApprovalBefore,
): ChangeRow[] {
  return [
    ...idRow("groupId", input.groupId, before),
    ...fieldChanges(input, ["name", "defaultOpen"], before),
  ];
}
