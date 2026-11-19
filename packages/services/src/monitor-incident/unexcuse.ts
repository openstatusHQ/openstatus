import { eq } from "@openstatus/db";
import { monitorIncidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError } from "../errors";
import type { MonitorIncident } from "../types";
import { getMonitorIncidentInWorkspace } from "./internal";
import { UnexcuseMonitorIncidentInput } from "./schemas";

export async function unexcuseMonitorIncident(args: {
  ctx: ServiceContext;
  input: UnexcuseMonitorIncidentInput;
}): Promise<MonitorIncident> {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = UnexcuseMonitorIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getMonitorIncidentInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    if (!existing.excusedAt) {
      throw new ConflictError("Incident is not excused.");
    }

    const updated = await tx
      .update(monitorIncidentTable)
      .set({
        excusedAt: null,
        excusedBy: null,
        excusedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(monitorIncidentTable.id, existing.id))
      .returning()
      .get();

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
