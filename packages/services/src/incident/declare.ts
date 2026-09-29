import { and, eq } from "@openstatus/db";
import {
  type Incident,
  incident,
  monitorIncidentTable,
  statusReport,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type DB,
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { NotFoundError } from "../errors";
import {
  appendIncidentEvent,
  assertMember,
  requireIncidentFeature,
} from "./internal";
import { assertStatusReportLinkable } from "./link-status-report";
import { DeclareIncidentInput } from "./schemas";

async function sourceStartedAt(
  tx: DB,
  workspaceId: number,
  source: DeclareIncidentInput["source"],
): Promise<Date | null> {
  if (!source) return null;
  if (source.type === "monitor_incident") {
    const row = await tx
      .select({ startedAt: monitorIncidentTable.startedAt })
      .from(monitorIncidentTable)
      .where(
        and(
          eq(monitorIncidentTable.id, source.id),
          eq(monitorIncidentTable.workspaceId, workspaceId),
        ),
      )
      .get();
    if (!row) throw new NotFoundError("monitor_incident", source.id);
    return row.startedAt;
  }
  const row = await tx
    .select({ createdAt: statusReport.createdAt })
    .from(statusReport)
    .where(
      and(
        eq(statusReport.id, source.id),
        eq(statusReport.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("status_report", source.id);
  return row.createdAt;
}

export async function declareIncident(args: {
  ctx: ServiceContext;
  input: DeclareIncidentInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  requireIncidentFeature(ctx);
  const input = DeclareIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    if (input.commanderId != null) {
      await assertMember(tx, ctx.workspace.id, input.commanderId);
    }
    if (input.statusReportId !== undefined) {
      await assertStatusReportLinkable(tx, ctx.workspace.id, {
        statusReportId: input.statusReportId,
      });
    }

    const declaredAt = new Date();
    const startedAt =
      input.startedAt ??
      (await sourceStartedAt(tx, ctx.workspace.id, input.source)) ??
      declaredAt;

    const record = await tx
      .insert(incident)
      .values({
        workspaceId: ctx.workspace.id,
        title: input.title,
        severity: input.severity,
        summary: input.summary ?? null,
        commanderId: input.commanderId ?? null,
        declaredBy: tryGetActorUserId(ctx.actor),
        declaredAt,
        startedAt,
        statusReportId: input.statusReportId ?? null,
      })
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "incident.create",
      entityType: "incident",
      entityId: record.id,
      after: record,
      ...(input.source
        ? { metadata: { source: input.source.type, ref: input.source.id } }
        : {}),
    });

    await appendIncidentEvent(tx, ctx, {
      incidentId: record.id,
      type: "declared",
      message: `Declared as ${input.severity}: ${input.title}`,
      createdAt: declaredAt,
    });
    if (input.statusReportId !== undefined) {
      await appendIncidentEvent(tx, ctx, {
        incidentId: record.id,
        type: "status_report_linked",
        message: `Linked status report #${input.statusReportId}`,
      });
    }
    return record;
  });
}
