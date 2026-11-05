import type { AgentToolInput } from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"update_maintenance">;

const fields = ["title", "from", "to", "pageComponentIds", "message"] as const;

export function updateMaintenanceChanges(input: Input): ChangeRow[] {
  const changes: ChangeRow[] = [
    { field: "maintenanceId", after: input.maintenanceId },
  ];
  for (const field of fields) {
    if (input[field] !== undefined) {
      changes.push({ field, after: input[field] });
    }
  }
  return changes;
}
