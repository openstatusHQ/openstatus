import { and, eq, isNull } from "@openstatus/db";
import {
  type Incident,
  incident,
  incidentResponsePatch,
  incidentSlaResponseMet,
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
  appendIncidentSlaBreaches,
  assertNotClosed,
  getIncidentInWorkspace,
  meetResponse,
  responsePatchGuard,
} from "./internal";
import { IncidentIdInput } from "./schemas";

/** Explicit acknowledge; set once, so a second call conflicts. Works on every plan. */
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
    assertNotClosed(existing);

    const now = new Date();
    const response =
      incidentSlaResponseMet(existing.slaSnapshot) === "acknowledged"
        ? incidentResponsePatch(existing, now)
        : {};
    const acknowledged = await tx
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
        ),
      )
      .returning()
      .get();
    if (!acknowledged) {
      throw new ConflictError(
        `Incident #${existing.id} is already acknowledged`,
      );
    }
    const met = response.responseMetAt
      ? await tx
          .update(incident)
          .set(response)
          .where(responsePatchGuard(existing.id, response))
          .returning()
          .get()
      : undefined;

    await emitAudit(tx, ctx, {
      action: "incident.update",
      entityType: "incident",
      entityId: existing.id,
      before: existing,
      after: met ?? acknowledged,
    });
    if (met) await appendIncidentSlaBreaches(tx, ctx, existing, response, now);
    else if (response.responseMetAt) {
      await meetResponse(tx, ctx, existing.id, now);
    }
    await appendIncidentEvent(tx, ctx, {
      incidentId: existing.id,
      type: "acknowledged",
      message: "Incident acknowledged",
      createdAt: now,
    });
    if (met) return met;
    if (!response.responseMetAt) return acknowledged;
    return getIncidentInWorkspace(tx, ctx.workspace.id, existing.id);
  });
}
