import { and, eq, ne } from "@openstatus/db";
import {
  type Incident,
  incident,
  statusReport,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type DB, type ServiceContext, withTransaction } from "../context";
import { ConflictError, NotFoundError } from "../errors";
import {
  appendIncidentEvent,
  assertNotClosed,
  getIncidentInWorkspace,
} from "./internal";
import { IncidentIdInput, LinkIncidentStatusReportInput } from "./schemas";

export async function assertStatusReportLinkable(
  tx: DB,
  workspaceId: number,
  args: { statusReportId: number; incidentId?: number },
): Promise<void> {
  const report = await tx
    .select({ id: statusReport.id })
    .from(statusReport)
    .where(
      and(
        eq(statusReport.id, args.statusReportId),
        eq(statusReport.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!report) throw new NotFoundError("status_report", args.statusReportId);

  const holder = await tx
    .select({ id: incident.id })
    .from(incident)
    .where(
      and(
        eq(incident.statusReportId, args.statusReportId),
        ...(args.incidentId !== undefined
          ? [ne(incident.id, args.incidentId)]
          : []),
      ),
    )
    .get();
  if (holder) {
    throw new ConflictError(
      `Status report #${args.statusReportId} is already linked to incident #${holder.id}`,
    );
  }
}

async function setStatusReport(
  tx: DB,
  ctx: ServiceContext,
  existing: Incident,
  statusReportId: number | null,
): Promise<Incident> {
  const updated = await tx
    .update(incident)
    .set({ statusReportId, updatedAt: new Date() })
    .where(eq(incident.id, existing.id))
    .returning()
    .get();
  await emitAudit(tx, ctx, {
    action: "incident.update",
    entityType: "incident",
    entityId: updated.id,
    before: existing,
    after: updated,
  });
  await appendIncidentEvent(tx, ctx, {
    incidentId: updated.id,
    type:
      statusReportId === null
        ? "status_report_unlinked"
        : "status_report_linked",
    message:
      statusReportId === null
        ? `Unlinked status report #${existing.statusReportId}`
        : `Linked status report #${statusReportId}`,
  });
  return updated;
}

// The update and its `incident.update` audit row live in `setStatusReport`.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function linkIncidentStatusReport(args: {
  ctx: ServiceContext;
  input: LinkIncidentStatusReportInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = LinkIncidentStatusReportInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace(
      tx,
      ctx.workspace.id,
      input.id,
    );
    assertNotClosed(existing);
    if (existing.statusReportId === input.statusReportId) return existing;
    if (existing.statusReportId !== null) {
      throw new ConflictError(
        `Incident #${existing.id} is already linked to status report #${existing.statusReportId}`,
      );
    }
    await assertStatusReportLinkable(tx, ctx.workspace.id, {
      statusReportId: input.statusReportId,
      incidentId: existing.id,
    });
    return setStatusReport(tx, ctx, existing, input.statusReportId);
  });
}

// The update and its `incident.update` audit row live in `setStatusReport`.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function unlinkIncidentStatusReport(args: {
  ctx: ServiceContext;
  input: IncidentIdInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = IncidentIdInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace(
      tx,
      ctx.workspace.id,
      input.id,
    );
    assertNotClosed(existing);
    if (existing.statusReportId === null) return existing;
    return setStatusReport(tx, ctx, existing, null);
  });
}

/**
 * Detaches whichever incident holds the report, closed or not. Runs inside
 * the status-report delete so the FK's set-null is never silent.
 */
export async function unlinkIncidentFromStatusReport(args: {
  tx: DB;
  ctx: ServiceContext;
  statusReportId: number;
}): Promise<void> {
  const { tx, ctx } = args;
  const holder = await tx
    .select()
    .from(incident)
    .where(
      and(
        eq(incident.statusReportId, args.statusReportId),
        eq(incident.workspaceId, ctx.workspace.id),
      ),
    )
    .get();
  if (!holder) return;
  await setStatusReport(tx, ctx, holder, null);
}
