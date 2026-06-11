import { eq } from "@openstatus/db";
import {
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError, InternalServiceError } from "../errors";
import type { StatusReport, StatusReportUpdate } from "../types";
import {
  getCurrentImpactsForReport,
  getReportInWorkspace,
  insertUpdateComponentImpacts,
  sortComponentImpacts,
  validatePageComponentIds,
} from "./internal";
import { AddStatusReportUpdateInput } from "./schemas";

export type AddStatusReportUpdateResult = {
  statusReport: StatusReport;
  statusReportUpdate: StatusReportUpdate;
};

export async function addStatusReportUpdate(args: {
  ctx: ServiceContext;
  input: AddStatusReportUpdateInput;
}): Promise<AddStatusReportUpdateResult> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = AddStatusReportUpdateInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const report = await getReportInWorkspace({
      tx,
      id: input.statusReportId,
      workspaceId: ctx.workspace.id,
    });

    const date = input.date ?? new Date();

    const componentImpacts = input.componentImpacts ?? [];
    if (componentImpacts.length > 0) {
      const validated = await validatePageComponentIds({
        tx,
        workspaceId: ctx.workspace.id,
        pageComponentIds: componentImpacts.map((ci) => ci.pageComponentId),
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
      // set — an update is the only way to add a component after creation.
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

    // resolve clears every still-non-operational component not named by this
    // update, so the page clears deterministically. Computed before this
    // update's rows are written; empty map (legacy report) stays legacy.
    let writtenImpacts = componentImpacts;
    if (input.status === "resolved") {
      const current = await getCurrentImpactsForReport(tx, report.id);
      const named = new Set(componentImpacts.map((ci) => ci.pageComponentId));
      const clears = [...current]
        .filter(
          ([componentId, impact]) =>
            impact !== "operational" && !named.has(componentId),
        )
        .map(([pageComponentId]) => ({
          pageComponentId,
          impact: "operational" as const,
        }));
      writtenImpacts = [...componentImpacts, ...clears];
    }

    const newUpdate = await tx
      .insert(statusReportUpdate)
      .values({
        statusReportId: report.id,
        status: input.status,
        date,
        message: input.message,
      })
      .returning()
      .get();

    await insertUpdateComponentImpacts({
      tx,
      statusReportUpdateId: newUpdate.id,
      componentImpacts: writtenImpacts,
    });

    const updatedReport = await tx
      .update(statusReport)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(statusReport.id, report.id))
      .returning()
      .get();

    if (!updatedReport) {
      throw new InternalServiceError(
        `failed to bump status report ${report.id} after adding update`,
      );
    }

    await emitAudit(tx, ctx, {
      action: "status_report_update.create",
      entityType: "status_report_update",
      entityId: newUpdate.id,
      after: {
        ...newUpdate,
        componentImpacts: sortComponentImpacts(writtenImpacts),
      },
      metadata: { statusReportId: report.id },
    });

    return { statusReport: updatedReport, statusReportUpdate: newUpdate };
  });
}
