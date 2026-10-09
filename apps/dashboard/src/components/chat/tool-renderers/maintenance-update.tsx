import type { AgentToolInput } from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

export function addMaintenanceUpdateChanges(
  input: AgentToolInput<"add_maintenance_update">,
  applied?: { id: number; notified: boolean },
): ChangeRow[] {
  return [
    ...(applied ? [{ field: "id", after: applied.id }] : []),
    { field: "maintenanceId", after: input.maintenanceId },
    { field: "message", after: input.message },
    ...(input.date ? [{ field: "date", after: input.date }] : []),
    { field: "notify", after: applied?.notified ?? input.notify },
  ];
}

export function updateMaintenanceUpdateChanges(
  input: AgentToolInput<"update_maintenance_update">,
): ChangeRow[] {
  return [
    { field: "id", after: input.id },
    ...(input.message ? [{ field: "message", after: input.message }] : []),
    ...(input.date ? [{ field: "date", after: input.date }] : []),
  ];
}

export function deleteMaintenanceUpdateChanges(
  input: AgentToolInput<"delete_maintenance_update">,
): ChangeRow[] {
  return [{ field: "id", before: input.id }];
}
