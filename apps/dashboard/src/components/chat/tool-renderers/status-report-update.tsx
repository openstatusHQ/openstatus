import type { AgentToolInput } from "@openstatus/services/agent-tools";
import { formatComponentImpacts } from "@openstatus/services/status-report/utils";

import type { ChangeRow } from "@/components/common/changes-table";

export function updateStatusReportUpdateChanges(
  input: AgentToolInput<"update_status_report_update">,
): ChangeRow[] {
  return [
    { field: "id", after: input.id },
    ...(input.status ? [{ field: "status", after: input.status }] : []),
    ...(input.message ? [{ field: "message", after: input.message }] : []),
    ...(input.date ? [{ field: "date", after: input.date }] : []),
    ...(input.componentImpacts
      ? [
          {
            field: "componentImpacts",
            after: input.componentImpacts.length
              ? formatComponentImpacts(input.componentImpacts)
              : [],
          },
        ]
      : []),
  ];
}

export function deleteStatusReportUpdateChanges(
  input: AgentToolInput<"delete_status_report_update">,
): ChangeRow[] {
  return [{ field: "id", before: input.id }];
}
