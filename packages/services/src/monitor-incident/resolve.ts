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
import { ResolveMonitorIncidentInput } from "./schemas";

export async function resolveMonitorIncident(args: {
  ctx: ServiceContext;
  input: ResolveMonitorIncidentInput;
}): Promise<MonitorIncident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = ResolveMonitorIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getMonitorIncidentInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    if (existing.resolvedAt) {
      throw new ConflictError("Incident already resolved.");
    }

    const now = new Date();
    // Conditional update — atomically flips `resolved_at` only while it is
    // still NULL. Concurrent resolvers lose the race and get a no-row
    // return, which we translate into the same `ConflictError`.
    const updated = await tx
      .update(monitorIncidentTable)
      .set({
        resolvedAt: now,
        resolvedBy: tryGetActorUserId(ctx.actor),
        updatedAt: now,
      })
      .where(
        and(
          eq(monitorIncidentTable.id, existing.id),
          isNull(monitorIncidentTable.resolvedAt),
        ),
      )
      .returning()
      .get();
    if (!updated) {
      throw new ConflictError("Incident already resolved.");
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
