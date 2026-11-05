import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

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
): ChangeRow[] {
  const changes: ChangeRow[] = [{ field: "monitorId", after: input.monitorId }];
  for (const field of fields) {
    if (input[field] !== undefined) {
      changes.push({ field, after: input[field] });
    }
  }
  if (applied) {
    changes.push({ field: "dashboardUrl", after: applied.dashboardUrl });
  }
  return changes;
}
