import { eq, sql } from "@openstatus/db";
import { statusReport, statusReportUpdate } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ConflictError } from "../errors";
import { unlinkIncidentFromStatusReport } from "../incident/link-status-report";
import { recomputeReportStatus } from "./derive-status";
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
  requireScope(ctx, "write");
  const input = DeleteStatusReportInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const report = await getReportInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await unlinkIncidentFromStatusReport({
      tx,
      ctx,
      statusReportId: report.id,
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
  requireScope(ctx, "write");
  const input = DeleteStatusReportUpdateInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getReportUpdateInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    // the report's status and message are derived from its updates
    const remaining = await tx
      .select({ count: sql<number>`count(*)` })
      .from(statusReportUpdate)
      .where(eq(statusReportUpdate.statusReportId, existing.statusReportId))
      .get();
    if ((remaining?.count ?? 0) <= 1) {
      throw new ConflictError(
        "A status report needs at least one update. Delete the report instead.",
      );
    }

    await tx
      .delete(statusReportUpdate)
      .where(eq(statusReportUpdate.id, existing.id));

    // deleting the latest update hands the status back to the one before it
    await recomputeReportStatus(tx, existing.statusReportId, {
      updatedBy: tryGetActorUserId(ctx.actor),
      removed: existing,
    });

    await emitAudit(tx, ctx, {
      action: "status_report_update.delete",
      entityType: "status_report_update",
      entityId: existing.id,
      before: existing,
      metadata: { statusReportId: existing.statusReportId },
    });
  });
}
