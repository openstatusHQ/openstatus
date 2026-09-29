import { and, eq, isNull } from "@openstatus/db";
import { incident, incidentEvent } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError } from "../errors";
import { getIncidentInWorkspace, requireIncidentFeature } from "./internal";
import { IncidentIdInput } from "./schemas";

/**
 * For incidents declared by mistake: only while open and never mitigated or
 * resolved. Anything further along is history. The timeline goes with it; its
 * events are already in the audit log.
 */
export async function deleteIncident(args: {
  ctx: ServiceContext;
  input: IncidentIdInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  requireIncidentFeature(ctx);
  const input = IncidentIdInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace(
      tx,
      ctx.workspace.id,
      input.id,
    );
    await requireRole(tx, ctx, ["owner", "admin"]);
    if (!isDeletable(existing)) {
      throw new ConflictError(
        `Incident #${existing.id} has progressed and can no longer be deleted`,
      );
    }
    await tx
      .delete(incidentEvent)
      .where(eq(incidentEvent.incidentId, existing.id));
    // Repeats `isDeletable` so an incident that progressed concurrently stays.
    const deleted = await tx
      .delete(incident)
      .where(
        and(
          eq(incident.id, existing.id),
          eq(incident.status, "open"),
          isNull(incident.mitigatedAt),
          isNull(incident.resolvedAt),
          isNull(incident.closedAt),
        ),
      )
      .returning()
      .get();
    if (!deleted) {
      throw new ConflictError(`Incident #${existing.id} changed concurrently`);
    }
    await emitAudit(tx, ctx, {
      action: "incident.delete",
      entityType: "incident",
      entityId: deleted.id,
      before: deleted,
    });
  });
}

export function isDeletable(row: {
  status: string;
  mitigatedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
}): boolean {
  return (
    row.status === "open" &&
    row.mitigatedAt === null &&
    row.resolvedAt === null &&
    row.closedAt === null
  );
}
