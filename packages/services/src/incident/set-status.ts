import { and, eq } from "@openstatus/db";
import {
  type Incident,
  type IncidentEventType,
  type IncidentStatus,
  incident,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ConflictError } from "../errors";
import {
  appendIncidentEvent,
  assertTransition,
  getIncidentInWorkspace,
} from "./internal";
import { SetIncidentStatusInput } from "./schemas";

function eventFor(
  from: IncidentStatus,
  to: IncidentStatus,
  note: string | undefined,
): { type: IncidentEventType; message: string } {
  if (to === "resolved") {
    return { type: "resolved", message: note ?? "Incident resolved" };
  }
  if (to === "canceled") {
    return { type: "canceled", message: note ?? "Incident canceled" };
  }
  const summary = `Status changed from ${from} to ${to}`;
  return {
    type: "status_changed",
    message: note ? `${summary}\n\n${note}` : summary,
  };
}

/**
 * Moves the incident along the transition table. The update is conditional on
 * the status read, so of two concurrent calls only one lands.
 */
export async function setIncidentStatus(args: {
  ctx: ServiceContext;
  input: SetIncidentStatusInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = SetIncidentStatusInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace(
      tx,
      ctx.workspace.id,
      input.id,
    );
    assertTransition(existing, input.status);

    const now = new Date();
    const patch: Partial<typeof incident.$inferInsert> = {
      status: input.status,
      updatedAt: now,
    };
    if (input.status === "mitigated") {
      patch.mitigatedAt = existing.mitigatedAt ?? now;
    }
    if (input.status === "resolved") {
      patch.resolvedAt = now;
      patch.resolvedBy = tryGetActorUserId(ctx.actor);
    }
    if (input.status === "open") {
      patch.resolvedBy = null;
    }
    if (input.status === "canceled") {
      patch.closedAt = now;
    }

    const updated = await tx
      .update(incident)
      .set(patch)
      .where(
        and(eq(incident.id, existing.id), eq(incident.status, existing.status)),
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
      ...eventFor(existing.status, input.status, input.note),
      createdAt: now,
    });
    return updated;
  });
}
