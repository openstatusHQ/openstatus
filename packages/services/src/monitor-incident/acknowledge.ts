import { and, eq, isNull } from "@openstatus/db";
import { monitorIncidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ConflictError } from "../errors";
import type { MonitorIncident } from "../types";
import { getMonitorIncidentInWorkspace } from "./internal";
import { AcknowledgeMonitorIncidentInput } from "./schemas";

export async function acknowledgeMonitorIncident(args: {
  ctx: ServiceContext;
  input: AcknowledgeMonitorIncidentInput;
}): Promise<MonitorIncident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = AcknowledgeMonitorIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getMonitorIncidentInWorkspace({
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
      .update(monitorIncidentTable)
      .set({
        acknowledgedAt: now,
        acknowledgedBy: tryGetActorUserId(ctx.actor),
        updatedAt: now,
      })
      .where(
        and(
          eq(monitorIncidentTable.id, existing.id),
          isNull(monitorIncidentTable.acknowledgedAt),
        ),
      )
      .returning()
      .get();
    if (!updated) {
      throw new ConflictError("Incident already acknowledged.");
    }

    await emitAudit(tx, ctx, {
      action: "monitor_incident.update",
      entityType: "monitor_incident",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
