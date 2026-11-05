import { and, eq, isNull } from "@openstatus/db";
import { incident } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import type { DB, ServiceContext } from "../context";
import { appendIncidentEvent } from "./internal";

/**
 * A member who leaves stops commanding the workspace's open incidents. Closed
 * incidents keep their commander: that is history.
 */
export async function clearIncidentCommander(args: {
  tx: DB;
  ctx: ServiceContext;
  userId: number;
}): Promise<void> {
  const { tx, ctx, userId } = args;
  const commanded = await tx
    .select()
    .from(incident)
    .where(
      and(
        eq(incident.workspaceId, ctx.workspace.id),
        eq(incident.commanderId, userId),
        isNull(incident.closedAt),
      ),
    )
    .all();

  for (const existing of commanded) {
    const updated = await tx
      .update(incident)
      .set({ commanderId: null, updatedAt: new Date() })
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
      type: "commander_changed",
      message: "Commander removed: they left the workspace",
    });
  }
}
