import type {
  AgentToolInput,
  AgentToolOutput,
  ApprovalBefore,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

import { fieldChanges, idRow } from "./before-diff";

type Input = AgentToolInput<"update_page_component">;
type Output = AgentToolOutput<"update_page_component">;

const fields = ["name", "description", "order", "groupId"] as const;

export function updatePageComponentChanges(
  input: Input,
  applied?: Output,
  before?: ApprovalBefore,
): ChangeRow[] {
  const changes: ChangeRow[] = [
    ...idRow("componentId", input.componentId, before),
    ...fieldChanges(input, fields, before),
  ];
  if (applied) changes.push({ field: "pageId", after: applied.pageId });
  return changes;
}
