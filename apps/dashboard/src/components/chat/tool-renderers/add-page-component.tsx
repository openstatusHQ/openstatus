import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"add_page_component">;
type Output = AgentToolOutput<"add_page_component">;

export function addPageComponentChanges(
  input: Input,
  applied?: Output,
): ChangeRow[] {
  const changes: ChangeRow[] = [];
  if (applied) changes.push({ field: "id", after: applied.id });
  changes.push(
    { field: "pageId", after: input.pageId },
    { field: "monitorId", after: input.monitorId },
  );
  const name = applied?.name ?? input.name;
  if (name) changes.push({ field: "name", after: name });
  if (input.description) {
    changes.push({ field: "description", after: input.description });
  }
  if (applied) changes.push({ field: "order", after: applied.order });
  return changes;
}
