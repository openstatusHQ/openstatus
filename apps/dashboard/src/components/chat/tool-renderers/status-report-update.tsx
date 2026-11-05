import type {
  AgentToolInput,
  ApprovalBefore,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

import { fieldChanges, idRow } from "./before-diff";

export function updateStatusReportUpdateChanges(
  input: AgentToolInput<"update_status_report_update">,
  before?: ApprovalBefore,
): ChangeRow[] {
  return [
    ...idRow("id", input.id, before),
    ...fieldChanges(
      input,
      ["status", "message", "date", "componentImpacts"],
      before,
    ),
  ];
}

export function deleteStatusReportUpdateChanges(
  input: AgentToolInput<"delete_status_report_update">,
): ChangeRow[] {
  return [{ field: "id", before: input.id }];
}
