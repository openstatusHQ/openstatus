import { eq } from "@openstatus/db";
import {
  statusReport,
  statusReportUpdate,
  statusReportUpdateToPageComponents,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError, InternalServiceError } from "../errors";
import type { StatusReport, StatusReportUpdate } from "../types";
import { recomputeReportStatus } from "./derive-status";
import {
  getComponentImpactsForUpdate,
  getPageComponentIdsForReport,
  getReportInWorkspace,
  getReportUpdateInWorkspace,
  insertUpdateComponentImpacts,
  pruneImpactRowsOutsideMembership,
  updatePageComponentAssociations,
  validatePageComponentIds,
  withComponentImpacts,
  withPageComponentIds,
} from "./internal";
import {
  UpdateStatusReportInput,
  UpdateStatusReportUpdateInput,
} from "./schemas";

/**
 * Update status-report metadata (title / status) and optionally replace the
 * full set of page-component associations. Passing
 * `pageComponentIds: []` clears the associations but leaves `pageId`
 * untouched; omitting the field leaves both untouched.
 *
 * A non-empty set moves the report to whatever page those components live
 * on. Mixed-page inputs are rejected upstream by `validatePageComponentIds`
 * (all ids must share a page).
 */
export async function updateStatusReport(args: {
  ctx: ServiceContext;
  input: UpdateStatusReportInput;
}): Promise<StatusReport> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdateStatusReportInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const report = await getReportInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    // snapshot membership before/after so association-only edits still
    // produce a visible audit diff (join-table change, not an entity field)
    const beforeComponentIds = await getPageComponentIdsForReport(
      tx,
      report.id,
    );
    let afterComponentIds = beforeComponentIds;

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) updateValues.title = input.title;
    if (input.status !== undefined) updateValues.status = input.status;

    if (input.pageComponentIds !== undefined) {
      const validated = await validatePageComponentIds({
        tx,
        workspaceId: ctx.workspace.id,
        pageComponentIds: input.pageComponentIds,
      });

      if (validated.pageId !== null) {
        updateValues.pageId = validated.pageId;
      }

      await updatePageComponentAssociations({
        tx,
        statusReportId: report.id,
        componentIds: validated.componentIds,
      });
      await pruneImpactRowsOutsideMembership({
        tx,
        statusReportId: report.id,
        componentIds: validated.componentIds,
      });
      afterComponentIds = validated.componentIds;
    }

    const updated = await tx
      .update(statusReport)
      .set(updateValues)
      .where(eq(statusReport.id, report.id))
      .returning()
      .get();

    if (!updated) {
      throw new InternalServiceError(
        `failed to update status report ${report.id}`,
      );
    }

    await emitAudit(tx, ctx, {
      action: "status_report.update",
      entityType: "status_report",
      entityId: updated.id,
      before: withPageComponentIds(report, beforeComponentIds),
      after: withPageComponentIds(updated, afterComponentIds),
    });

    return updated;
  });
}

/** Edit a single status-report update row (message / date / status / impacts). */
export async function updateStatusReportUpdate(args: {
  ctx: ServiceContext;
  input: UpdateStatusReportUpdateInput;
}): Promise<StatusReportUpdate> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdateStatusReportUpdateInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getReportUpdateInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const beforeImpacts = await getComponentImpactsForUpdate(tx, existing.id);
    const afterImpacts = input.componentImpacts ?? beforeImpacts;

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.message !== undefined) updateValues.message = input.message;
    if (input.date !== undefined) updateValues.date = input.date;

    // replace the update's impact-row set; omitted ⇒ untouched (legacy stays legacy)
    if (input.componentImpacts !== undefined) {
      const report = await getReportInWorkspace({
        tx,
        id: existing.statusReportId,
        workspaceId: ctx.workspace.id,
      });

      if (input.componentImpacts.length > 0) {
        const validated = await validatePageComponentIds({
          tx,
          workspaceId: ctx.workspace.id,
          pageComponentIds: input.componentImpacts.map(
            (ci) => ci.pageComponentId,
          ),
        });
        if (
          validated.pageId !== null &&
          report.pageId !== null &&
          validated.pageId !== report.pageId
        ) {
          throw new ConflictError(
            `Components belong to page ${validated.pageId}, not the report's page ${report.pageId}.`,
          );
        }
        // invariant: every impact row's component is in the report's membership
        // set — editing impacts intentionally extends it (same as add-update)
        await tx
          .insert(statusReportsToPageComponents)
          .values(
            validated.componentIds.map((pageComponentId) => ({
              statusReportId: report.id,
              pageComponentId,
            })),
          )
          .onConflictDoNothing();
      }

      await tx
        .delete(statusReportUpdateToPageComponents)
        .where(
          eq(
            statusReportUpdateToPageComponents.statusReportUpdateId,
            existing.id,
          ),
        );
      await insertUpdateComponentImpacts({
        tx,
        statusReportUpdateId: existing.id,
        componentImpacts: input.componentImpacts,
      });
    }

    const updated = await tx
      .update(statusReportUpdate)
      .set(updateValues)
      .where(eq(statusReportUpdate.id, existing.id))
      .returning()
      .get();

    if (!updated) {
      throw new InternalServiceError(
        `failed to update status report update ${existing.id}`,
      );
    }

    // editing status or date can change which update is latest
    await recomputeReportStatus(tx, existing.statusReportId);

    await emitAudit(tx, ctx, {
      action: "status_report_update.update",
      entityType: "status_report_update",
      entityId: updated.id,
      before: withComponentImpacts(existing, beforeImpacts),
      after: withComponentImpacts(updated, afterImpacts),
      metadata: { statusReportId: existing.statusReportId },
    });

    return updated;
  });
}
