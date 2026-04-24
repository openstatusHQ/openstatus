import { and, eq, isNull } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ConflictError } from "../errors";
import type { Incident } from "../types";
import { getIncidentInWorkspace } from "./internal";
import { AcknowledgeIncidentInput } from "./schemas";

export async function acknowledgeIncident(args: {
  ctx: ServiceContext;
  input: AcknowledgeIncidentInput;
}): Promise<Incident> {
  const { ctx } = args;
  const input = AcknowledgeIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    if (existing.acknowledgedAt) {
      throw new ConflictError("Incident already acknowledged.");
    }

    const now = new Date();
    // Conditional update — atomically flips `acknowledged_at` only while it
    // is still NULL. A concurrent acknowledger losing the race returns no
    // row, at which point we throw the same `ConflictError` the pre-read
    // would have raised.
    const updated = await tx
      .update(incidentTable)
      .set({
        acknowledgedAt: now,
        acknowledgedBy: tryGetActorUserId(ctx.actor),
        updatedAt: now,
      })
      .where(
        and(
          eq(incidentTable.id, existing.id),
          isNull(incidentTable.acknowledgedAt),
        ),
      )
      .returning()
      .get();
    if (!updated) {
      throw new ConflictError("Incident already acknowledged.");
    }

    await emitAudit(tx, ctx, {
      action: "incident.update",
      entityType: "incident",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
