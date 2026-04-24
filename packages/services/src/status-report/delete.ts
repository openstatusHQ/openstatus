import { eq } from "@openstatus/db";
import { statusReport, statusReportUpdate } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { getReportInWorkspace, getReportUpdateInWorkspace } from "./internal";
import {
  DeleteStatusReportInput,
  DeleteStatusReportUpdateInput,
} from "./schemas";

/**
 * Delete a status report. Cascade removes updates and
 * `status_reports_to_page_components` rows.
 */
export async function deleteStatusReport(args: {
  ctx: ServiceContext;
  input: DeleteStatusReportInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeleteStatusReportInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const report = await getReportInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await tx.delete(statusReport).where(eq(statusReport.id, report.id));

    await emitAudit(tx, ctx, {
      action: "status_report.delete",
      entityType: "status_report",
      entityId: report.id,
      before: report,
    });
  });
}

/** Delete a single status-report update row. */
export async function deleteStatusReportUpdate(args: {
  ctx: ServiceContext;
  input: DeleteStatusReportUpdateInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeleteStatusReportUpdateInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getReportUpdateInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await tx
      .delete(statusReportUpdate)
      .where(eq(statusReportUpdate.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "status_report_update.delete",
      entityType: "status_report_update",
      entityId: existing.id,
      before: existing,
    });
  });
}
