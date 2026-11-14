import { and, eq, isNull } from "@openstatus/db";
import {
  type Incident,
  type IncidentEventType,
  type IncidentStatus,
  incident,
  incidentResolutionPatch,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type DB,
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ConcurrentUpdateError } from "../errors";
import {
  appendIncidentEvent,
  appendIncidentSlaBreaches,
  assertTransition,
  getIncidentInWorkspace,
  withAcknowledgement,
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

/** The conditional status write from `existing`; undefined when the row moved since. */
async function land(
  tx: DB,
  ctx: ServiceContext,
  existing: Incident,
  input: SetIncidentStatusInput,
) {
  const now = new Date();
  const resolution = incidentResolutionPatch(existing, input.status, now);
  const patch: Partial<typeof incident.$inferInsert> = {
    status: input.status,
    updatedAt: now,
    ...resolution,
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
      and(
        eq(incident.id, existing.id),
        eq(incident.status, existing.status),
        // the stop and its miss are stamped once
        resolution.resolutionStoppedAt
          ? isNull(incident.resolutionStoppedAt)
          : undefined,
        resolution.resolutionBreachDueAt
          ? isNull(incident.resolutionBreachDueAt)
          : undefined,
      ),
    )
    .returning()
    .get();
  return updated && { existing, updated, resolution, now };
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
  requireScope(ctx, "incidents:write");
  const input = SetIncidentStatusInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const read = await getIncidentInWorkspace(tx, ctx.workspace.id, input.id);
    assertTransition(read, input.status);

    let landed = await land(tx, ctx, read, input);
    if (!landed) {
      // a resolution miss the cron stamped since the read: land as a late stop
      const fresh = await getIncidentInWorkspace(tx, ctx.workspace.id, read.id);
      if (fresh.status === read.status) {
        landed = await land(tx, ctx, fresh, input);
      }
    }
    if (!landed) {
      throw new ConcurrentUpdateError(
        `Incident #${read.id} changed concurrently`,
      );
    }
    const { existing, updated, resolution, now } = landed;

    await emitAudit(tx, ctx, {
      action: "incident.update",
      entityType: "incident",
      entityId: updated.id,
      before: existing,
      after: updated,
    });
    await appendIncidentSlaBreaches(tx, ctx, existing, resolution, now);
    await appendIncidentEvent(tx, ctx, {
      incidentId: updated.id,
      ...eventFor(existing.status, input.status, input.note),
      createdAt: now,
    });
    return withAcknowledgement(tx, updated);
  });
}
