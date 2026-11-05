import type {
  AgentToolInput,
  ApprovalBefore,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

import { fieldChanges, idRow } from "./before-diff";

type Input = AgentToolInput<"update_maintenance">;

const fields = ["title", "from", "to", "pageComponentIds", "message"] as const;

export function updateMaintenanceChanges(
  input: Input,
  before?: ApprovalBefore,
): ChangeRow[] {
  return [
    ...idRow("maintenanceId", input.maintenanceId, before),
    ...fieldChanges(input, fields, before),
  ];
}
