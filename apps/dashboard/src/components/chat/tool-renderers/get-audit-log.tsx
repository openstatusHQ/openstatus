import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import {
  type ChangeRow,
  buildAuditLogChangeRows,
} from "@/components/common/changes-table";

type Output = AgentToolOutput<"get_audit_log">;

export function getAuditLogChanges(output: Output): ChangeRow[] {
  return buildAuditLogChangeRows({
    before: output.before,
    after: output.after,
    changedFields: output.changedFields,
  });
}
