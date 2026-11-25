import type {
  AgentToolInput,
  AgentToolOutput,
  ApprovalBefore,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

import { fieldChanges, idRow } from "./before-diff";

type Input = AgentToolInput<"update_monitor">;
type Output = AgentToolOutput<"update_monitor">;

const fields = [
  "name",
  "url",
  "method",
  "headers",
  "body",
  "assertions",
  "periodicity",
  "regions",
  "active",
  "description",
  "timeout",
  "degradedAfter",
  "notificationIds",
  "tagIds",
] as const;

/** Only the fields the model sent become rows; omitted ones keep their value. */
export function updateMonitorChanges(
  input: Input,
  applied?: Output,
  before?: ApprovalBefore,
): ChangeRow[] {
  const changes: ChangeRow[] = [
    ...idRow("monitorId", input.monitorId, before),
    ...fieldChanges(input, fields, before),
  ];
  if (applied) {
    changes.push({ field: "dashboardUrl", after: applied.dashboardUrl });
  }
  return changes;
}
