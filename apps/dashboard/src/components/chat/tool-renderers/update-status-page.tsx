import type {
  AgentToolInput,
  AgentToolOutput,
  ApprovalBefore,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

import { fieldChanges, idRow } from "./before-diff";

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
  before?: ApprovalBefore,
): ChangeRow[] {
  const changes: ChangeRow[] = [
    ...idRow("pageId", input.pageId, before),
    ...fieldChanges(input, fields, before),
  ];
  if (applied) {
    changes.push(
      { field: "url", after: applied.url },
      { field: "dashboardUrl", after: applied.dashboardUrl },
    );
  }
  return changes;
}
