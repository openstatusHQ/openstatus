import { eq } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError } from "../errors";
import { createStatusReport } from "../status-report";
import type { Incident, StatusReport } from "../types";
import { getIncidentInWorkspace } from "./internal";
import { PromoteIncidentInput } from "./schemas";

export type PromoteIncidentResult = {
  incident: Incident;
  statusReport: StatusReport;
};

const STATUS_REPORT_STATUS = {
  triage: "investigating",
  investigating: "investigating",
  identified: "identified",
  monitoring: "monitoring",
  resolved: "resolved",
} as const;

export async function promoteIncident(args: {
  ctx: ServiceContext;
  input: PromoteIncidentInput;
}): Promise<PromoteIncidentResult> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = PromoteIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const before = await getIncidentInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    if (before.statusReportId !== null) {
      throw new ConflictError("Incident already published as a status report.");
    }

    const { statusReport } = await createStatusReport({
      ctx: { ...ctx, db: tx },
      input: {
        title: before.title,
        status: STATUS_REPORT_STATUS[before.status],
        message: input.message,
        date: input.date ?? new Date(),
        pageId: input.pageId,
        pageComponentIds: input.pageComponentIds,
      },
    });

    const after = await tx
      .update(incidentTable)
      .set({ statusReportId: statusReport.id, updatedAt: new Date() })
      .where(eq(incidentTable.id, before.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "incident.promote",
      entityType: "incident",
      entityId: after.id,
      before,
      after,
      metadata: { statusReportId: statusReport.id },
    });

    return { incident: after, statusReport };
  });
}
