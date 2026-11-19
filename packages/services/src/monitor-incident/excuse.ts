import { and, eq, isNotNull, isNull } from "@openstatus/db";
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
import { ExcuseMonitorIncidentInput } from "./schemas";

export async function excuseMonitorIncident(args: {
  ctx: ServiceContext;
  input: ExcuseMonitorIncidentInput;
}): Promise<MonitorIncident> {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = ExcuseMonitorIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getMonitorIncidentInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    // An open outage excused now would show the page operational while down.
    if (!existing.resolvedAt) {
      throw new ConflictError("Only resolved incidents can be excused.");
    }
    // unexcuse first: a second excuse would replace who excused it and why
    if (existing.excusedAt) {
      throw new ConflictError("This incident is already excused.");
    }

    const now = new Date();
    const updated = await tx
      .update(monitorIncidentTable)
      .set({
        excusedAt: now,
        excusedBy: tryGetActorUserId(ctx.actor),
        excusedReason: input.reason,
        updatedAt: now,
      })
      .where(
        and(
          eq(monitorIncidentTable.id, existing.id),
          isNotNull(monitorIncidentTable.resolvedAt),
          isNull(monitorIncidentTable.excusedAt),
        ),
      )
      .returning()
      .get();
    if (!updated) {
      throw new ConflictError(
        "Only resolved incidents that are not excused yet can be excused.",
      );
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
