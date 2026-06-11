import type { AgentToolInput } from "@openstatus/services/agent-tools";
import { formatComponentImpacts } from "@openstatus/services/status-report/utils";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"create_status_report">;

type Applied = {
  id: number;
  notified?: boolean;
  /**
   * Server-set creation timestamp. Used as the fallback `date` value
   * when the input didn't override (server defaults `date` to `now()`).
   */
  createdAt?: string | null;
};

export function createStatusReportChanges(
  input: Input,
  applied?: Applied,
): ChangeRow[] {
  const changes: ChangeRow[] = [
    { field: "title", after: input.title },
    { field: "status", after: input.status },
    { field: "message", after: input.message },
    { field: "pageId", after: input.pageId },
    { field: "pageComponentIds", after: input.pageComponentIds },
    {
      field: "notify",
      after: applied?.notified !== undefined ? applied.notified : input.notify,
    },
  ];

  if (input.componentImpacts?.length) {
    changes.push({
      field: "componentImpacts",
      after: formatComponentImpacts(input.componentImpacts),
    });
  }

  const resolvedDate = input.date ?? undefined;
  if (resolvedDate !== undefined) {
    changes.push({ field: "date", after: resolvedDate });
  }

  if (applied?.createdAt) {
    changes.push({ field: "createdAt", after: applied.createdAt });
  }

  return changes;
}
