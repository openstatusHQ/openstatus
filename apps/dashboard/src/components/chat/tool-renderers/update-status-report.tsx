import type { AgentToolInput } from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"update_status_report">;

/**
 * Metadata edit on an existing status report. Only fields the model
 * actually proposed surface as rows — leaves other fields untouched in
 * the diff (the model is allowed to send a partial input).
 */
export function updateStatusReportChanges(input: Input): ChangeRow[] {
  const changes: ChangeRow[] = [
    { field: "statusReportId", after: input.statusReportId },
  ];
  if (input.title !== undefined) {
    changes.push({ field: "title", after: input.title });
  }
  if (input.status !== undefined) {
    changes.push({ field: "status", after: input.status });
  }
  if (input.pageComponentIds !== undefined) {
    changes.push({ field: "pageComponentIds", after: input.pageComponentIds });
  }
  return changes;
}
