import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"create_status_page">;
type Output = AgentToolOutput<"create_status_page">;

export function createStatusPageChanges(
  input: Input,
  applied?: Output,
): ChangeRow[] {
  const changes: ChangeRow[] = [];
  if (applied) changes.push({ field: "id", after: applied.id });
  changes.push(
    { field: "title", after: input.title },
    { field: "slug", after: applied?.slug ?? input.slug },
  );
  if (input.description) {
    changes.push({ field: "description", after: input.description });
  }
  if (applied) {
    changes.push(
      { field: "url", after: applied.url },
      { field: "dashboardUrl", after: applied.dashboardUrl },
    );
  }
  return changes;
}
