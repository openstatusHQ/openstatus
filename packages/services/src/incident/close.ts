import { and, eq, isNull } from "@openstatus/db";
import { type Incident, incident } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError } from "../errors";
import {
  appendIncidentEvent,
  assertNotClosed,
  getIncidentInWorkspace,
  requireIncidentFeature,
} from "./internal";
import { IncidentIdInput } from "./schemas";

/** Ends the incident's life: only a resolved one, by an admin, owner or its commander. */
export async function closeIncident(args: {
  ctx: ServiceContext;
  input: IncidentIdInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  requireIncidentFeature(ctx);
  const input = IncidentIdInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace(
      tx,
      ctx.workspace.id,
      input.id,
    );
    assertNotClosed(existing);
    await requireRole(tx, ctx, ["owner", "admin"], {
      orUserId: existing.commanderId,
    });
    if (existing.status !== "resolved") {
      throw new ConflictError(
        `Incident #${existing.id} must be resolved before it is closed`,
      );
    }

    const now = new Date();
    const updated = await tx
      .update(incident)
      .set({ closedAt: now, updatedAt: now })
      .where(
        and(
          eq(incident.id, existing.id),
          eq(incident.status, "resolved"),
          isNull(incident.closedAt),
        ),
      )
      .returning()
      .get();
    if (!updated) {
      throw new ConflictError(`Incident #${existing.id} changed concurrently`);
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
      type: "closed",
      message: "Incident closed",
      createdAt: now,
    });
    return updated;
  });
}
