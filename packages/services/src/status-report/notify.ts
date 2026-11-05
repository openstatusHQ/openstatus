import { db as defaultDb, eq } from "@openstatus/db";
import { statusReport, statusReportUpdate } from "@openstatus/db/src/schema";
import { dispatchStatusReportUpdate } from "@openstatus/subscriptions";

import { requireScope } from "../auth";
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
 *
 * Returns `true` when the update was dispatched, `false` when it was skipped
 * (plan without subscribers, or a report not attached to a page).
 */
export async function notifyStatusReport(args: {
  ctx: ServiceContext;
  input: NotifyStatusReportInput;
}): Promise<boolean> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = NotifyStatusReportInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const row = await db
    .select({
      updateId: statusReportUpdate.id,
      reportWorkspaceId: statusReport.workspaceId,
      reportPageId: statusReport.pageId,
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
    return false;
  }
  // The dispatcher silently drops reports without a page.
  if (!row.reportPageId) return false;

  await dispatchStatusReportUpdate(input.statusReportUpdateId);
  return true;
}
