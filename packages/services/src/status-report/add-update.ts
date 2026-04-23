import { eq } from "@openstatus/db";
import { statusReport, statusReportUpdate } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { InternalServiceError } from "../errors";
import type { StatusReport, StatusReportUpdate } from "../types";
import { getReportInWorkspace } from "./internal";
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
  const input = AddStatusReportUpdateInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const report = await getReportInWorkspace({
      tx,
      id: input.statusReportId,
      workspaceId: ctx.workspace.id,
    });

    const date = input.date ?? new Date();

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
      action: "status_report.add_update",
      entityType: "status_report_update",
      entityId: newUpdate.id,
      after: newUpdate,
      metadata: { statusReportId: report.id, status: input.status },
    });

    return { statusReport: updatedReport, statusReportUpdate: newUpdate };
  });
}
