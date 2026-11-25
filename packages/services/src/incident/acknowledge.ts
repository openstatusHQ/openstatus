import { and, eq, inArray, isNull } from "@openstatus/db";
import { type Incident, incident } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ConflictError } from "../errors";
import { appendIncidentEvent, getIncidentInWorkspace } from "./internal";
import { IncidentIdInput } from "./schemas";

/** Set once, and only while open or mitigated: a later ack would outlast the time to resolve. */
export async function acknowledgeIncident(args: {
  ctx: ServiceContext;
  input: IncidentIdInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = IncidentIdInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace(
      tx,
      ctx.workspace.id,
      input.id,
    );
    const now = new Date();
    const updated = await tx
      .update(incident)
      .set({
        acknowledgedAt: now,
        acknowledgedBy: tryGetActorUserId(ctx.actor),
        updatedAt: now,
      })
      .where(
        and(
          eq(incident.id, existing.id),
          isNull(incident.acknowledgedAt),
          isNull(incident.closedAt),
          inArray(incident.status, ["open", "mitigated"]),
        ),
      )
      .returning()
      .get();
    if (!updated) {
      throw new ConflictError(
        existing.acknowledgedAt
          ? `Incident #${existing.id} is already acknowledged`
          : `Incident #${existing.id} can only be acknowledged while open or mitigated`,
      );
    }
    await emitAudit(tx, ctx, {
      action: "incident.update",
      entityType: "incident",
      entityId: updated.id,
      before: existing,
      after: updated,
    });
    await appendIncidentEvent(tx, ctx, {
      incidentId: updated.id,
      type: "acknowledged",
      message: "Incident acknowledged",
      createdAt: now,
    });
    return updated;
  });
}
