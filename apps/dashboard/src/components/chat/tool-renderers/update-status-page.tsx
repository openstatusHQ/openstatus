import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"update_status_page">;
type Output = AgentToolOutput<"update_status_page">;

const fields = [
  "title",
  "slug",
  "description",
  "icon",
  "homepageUrl",
  "contactUrl",
] as const;

export function updateStatusPageChanges(
  input: Input,
  applied?: Output,
): ChangeRow[] {
  const changes: ChangeRow[] = [{ field: "pageId", after: input.pageId }];
  for (const field of fields) {
    if (input[field] !== undefined) {
      changes.push({ field, after: input[field] });
    }
  }
  if (applied) {
    changes.push(
      { field: "url", after: applied.url },
      { field: "dashboardUrl", after: applied.dashboardUrl },
    );
  }
  return changes;
}
