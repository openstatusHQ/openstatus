import type {
  AgentToolInput,
  ApprovalBefore,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

import { fieldChanges, idRow } from "./before-diff";

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
  before?: ApprovalBefore,
): ChangeRow[] {
  return [
    ...idRow("id", input.id, before),
    ...fieldChanges(input, ["message", "date"], before),
  ];
}

export function deleteMaintenanceUpdateChanges(
  input: AgentToolInput<"delete_maintenance_update">,
): ChangeRow[] {
  return [{ field: "id", before: input.id }];
}
