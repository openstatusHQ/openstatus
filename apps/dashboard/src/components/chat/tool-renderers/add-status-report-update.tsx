import type { AgentToolInput } from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"add_status_report_update">;

type Applied = {
  statusReportUpdateId: number;
  notified?: boolean;
};

export function addStatusReportUpdateChanges(
  input: Input,
  applied?: Applied,
): ChangeRow[] {
  const changes: ChangeRow[] = [
    { field: "statusReportId", after: input.statusReportId },
    { field: "status", after: input.status },
    { field: "message", after: input.message },
    {
      field: "notify",
      after: applied?.notified !== undefined ? applied.notified : input.notify,
    },
  ];
  if (input.componentImpacts?.length) {
    changes.push({
      field: "componentImpacts",
      after: input.componentImpacts.map(
        (ci) => `${ci.pageComponentId} → ${ci.impact}`,
      ),
    });
  }
  if (input.date) {
    changes.push({ field: "date", after: input.date });
  }
  return changes;
}
