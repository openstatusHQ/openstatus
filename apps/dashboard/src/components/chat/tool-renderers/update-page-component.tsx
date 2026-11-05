import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"update_page_component">;
type Output = AgentToolOutput<"update_page_component">;

export function updatePageComponentChanges(
  input: Input,
  applied?: Output,
): ChangeRow[] {
  const changes: ChangeRow[] = [
    { field: "componentId", after: input.componentId },
  ];
  if (input.name !== undefined) {
    changes.push({ field: "name", after: input.name });
  }
  if (input.description !== undefined) {
    changes.push({ field: "description", after: input.description });
  }
  if (input.order !== undefined) {
    changes.push({ field: "order", after: input.order });
  }
  if (input.groupId !== undefined) {
    changes.push({ field: "groupId", after: input.groupId });
  }
  if (applied) changes.push({ field: "pageId", after: applied.pageId });
  return changes;
}
