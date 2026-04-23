import { eq } from "@openstatus/db";
import { statusReport, statusReportUpdate } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { InternalServiceError } from "../errors";
import type { StatusReport, StatusReportUpdate } from "../types";
import {
  getReportInWorkspace,
  getReportUpdateInWorkspace,
  updatePageComponentAssociations,
  validatePageComponentIds,
} from "./internal";
import {
  UpdateStatusReportInput,
  UpdateStatusReportUpdateInput,
} from "./schemas";

/**
 * Update status-report metadata (title / status) and optionally replace the
 * full set of page-component associations. Passing
 * `pageComponentIds: []` clears the associations (and nulls `pageId`);
 * omitting the field leaves both untouched.
 *
 * The report's `pageId` follows its components: when the caller supplies
 * a new set of associations the report moves to whatever page those
 * components live on. Mixed-page inputs are rejected upstream by
 * `validatePageComponentIds` (all ids must share a page), so the only
 * states here are "one page" or "no components".
 */
export async function updateStatusReport(args: {
  ctx: ServiceContext;
  input: UpdateStatusReportInput;
}): Promise<StatusReport> {
  const { ctx } = args;
  const input = UpdateStatusReportInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const report = await getReportInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) updateValues.title = input.title;
    if (input.status !== undefined) updateValues.status = input.status;

    if (input.pageComponentIds !== undefined) {
      const validated = await validatePageComponentIds({
        tx,
        workspaceId: ctx.workspace.id,
        pageComponentIds: input.pageComponentIds,
      });

      // `pageId` follows the association set: a new non-empty set moves
      // the report to that page; an empty set nulls it. This is the
      // behavior the Connect `UpdateStatusReport` tests have encoded
      // since the original handler — no caller today wants a "report
      // pinned to page X regardless of its components" guarantee.
      updateValues.pageId = validated.pageId;

      await updatePageComponentAssociations({
        tx,
        statusReportId: report.id,
        componentIds: validated.componentIds,
      });
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
      before: report,
      after: updated,
    });

    return updated;
  });
}

/** Edit a single status-report update row (message / date / status). */
export async function updateStatusReportUpdate(args: {
  ctx: ServiceContext;
  input: UpdateStatusReportUpdateInput;
}): Promise<StatusReportUpdate> {
  const { ctx } = args;
  const input = UpdateStatusReportUpdateInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getReportUpdateInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.message !== undefined) updateValues.message = input.message;
    if (input.date !== undefined) updateValues.date = input.date;

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

    await emitAudit(tx, ctx, {
      action: "status_report.update_update",
      entityType: "status_report_update",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
