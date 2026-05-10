import type { AgentToolInput } from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"create_maintenance">;

type Applied = {
  id: number;
  notified?: boolean;
};

export function createMaintenanceChanges(
  input: Input,
  applied?: Applied,
): ChangeRow[] {
  return [
    { field: "title", after: input.title },
    { field: "message", after: input.message },
    { field: "from", after: input.from },
    { field: "to", after: input.to },
    { field: "pageId", after: input.pageId },
    { field: "pageComponentIds", after: input.pageComponentIds },
    {
      field: "notify",
      after: applied?.notified !== undefined ? applied.notified : input.notify,
    },
  ];
}
