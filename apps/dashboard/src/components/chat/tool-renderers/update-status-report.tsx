import type {
  AgentToolInput,
  ApprovalBefore,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

import { fieldChanges, idRow } from "./before-diff";

type Input = AgentToolInput<"update_status_report">;

const fields = ["title", "status", "pageComponentIds"] as const;

/**
 * Metadata edit on an existing status report. Only fields the model
 * actually proposed surface as rows — leaves other fields untouched in
 * the diff (the model is allowed to send a partial input).
 */
export function updateStatusReportChanges(
  input: Input,
  before?: ApprovalBefore,
): ChangeRow[] {
  return [
    ...idRow("statusReportId", input.statusReportId, before),
    ...fieldChanges(input, fields, before),
  ];
}
