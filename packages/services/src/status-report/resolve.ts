import type { ServiceContext } from "../context";
import {
  type AddStatusReportUpdateResult,
  addStatusReportUpdate,
} from "./add-update";
import { ResolveStatusReportInput } from "./schemas";

/**
 * Convenience over addStatusReportUpdate with status="resolved". Exists so
 * Slack's `resolveStatusReport` action has a named call site with matching
 * intent; audit action is still `status_report_update.create` (same db path).
 */
export async function resolveStatusReport(args: {
  ctx: ServiceContext;
  input: ResolveStatusReportInput;
}): Promise<AddStatusReportUpdateResult> {
  const input = ResolveStatusReportInput.parse(args.input);
  return addStatusReportUpdate({
    ctx: args.ctx,
    input: {
      statusReportId: input.statusReportId,
      status: "resolved",
      message: input.message,
      date: input.date,
    },
  });
}
