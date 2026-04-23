import { db as defaultDb, eq } from "@openstatus/db";
import { statusReport, statusReportUpdate } from "@openstatus/db/src/schema";
import { dispatchStatusReportUpdate } from "@openstatus/subscriptions";

import { emitAudit } from "../audit";
import type { ServiceContext } from "../context";
import { ForbiddenError, NotFoundError } from "../errors";
import { NotifyStatusReportInput } from "./schemas";

/**
 * Dispatch subscriber notifications for a specific status-report update.
 * Separate from the mutation services because the dashboard runs on the Edge
 * runtime and cannot fire-and-forget — callers invoke this as a second,
 * awaited call after the mutation (see service-layer-plan.md §Notifications).
 *
 * Enforces:
 *   - Workspace owns the target update (via join to the parent report).
 *   - Plan has `status-subscribers` enabled — otherwise no-op.
 */
export async function notifyStatusReport(args: {
  ctx: ServiceContext;
  input: NotifyStatusReportInput;
}): Promise<void> {
  const { ctx } = args;
  const input = NotifyStatusReportInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const row = await db
    .select({
      updateId: statusReportUpdate.id,
      reportWorkspaceId: statusReport.workspaceId,
    })
    .from(statusReportUpdate)
    .innerJoin(
      statusReport,
      eq(statusReportUpdate.statusReportId, statusReport.id),
    )
    .where(eq(statusReportUpdate.id, input.statusReportUpdateId))
    .get();

  if (!row) {
    throw new NotFoundError("status_report_update", input.statusReportUpdateId);
  }
  if (row.reportWorkspaceId !== ctx.workspace.id) {
    throw new ForbiddenError(
      "Status report update does not belong to this workspace.",
    );
  }

  if (!ctx.workspace.limits["status-subscribers"]) {
    // Plan does not enable subscribers — silently skip, matching existing
    // `emailRouter.sendStatusReport` behaviour.
    return;
  }

  await dispatchStatusReportUpdate(input.statusReportUpdateId);

  await emitAudit(db, ctx, {
    action: "status_report.notify",
    entityType: "status_report_update",
    entityId: input.statusReportUpdateId,
  });
}
