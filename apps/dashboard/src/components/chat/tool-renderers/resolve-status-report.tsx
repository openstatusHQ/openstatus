import type { AgentToolInput } from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"resolve_status_report">;

type Applied = {
  statusReportUpdateId: number;
  notified?: boolean;
};

export function resolveStatusReportChanges(
  input: Input,
  applied?: Applied,
): ChangeRow[] {
  const changes: ChangeRow[] = [
    { field: "statusReportId", after: input.statusReportId },
    { field: "status", after: "resolved" },
    { field: "message", after: input.message },
    {
      field: "notify",
      after: applied?.notified !== undefined ? applied.notified : input.notify,
    },
  ];
  if (input.date) {
    changes.push({ field: "date", after: input.date });
  }
  return changes;
}
