import { eq } from "@openstatus/db";
import {
  type Incident,
  incident,
  incidentSlaState,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { PreconditionFailedError } from "../errors";
import { appendIncidentEvent, getIncidentInWorkspace } from "./internal";
import { SetIncidentSlaMissReasonInput } from "./schemas";

/** Writes, replaces or clears why a recorded response or resolution miss happened. */
export async function setIncidentSlaMissReason(args: {
  ctx: ServiceContext;
  input: SetIncidentSlaMissReasonInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = SetIncidentSlaMissReasonInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace(
      tx,
      ctx.workspace.id,
      input.id,
    );
    const timer = incidentSlaState(existing, new Date())?.[input.kind];
    if (!timer?.breachDueAt) {
      throw new PreconditionFailedError(
        `Incident #${existing.id} has no recorded ${input.kind} miss`,
      );
    }

    const column =
      input.kind === "response" ? "responseMissReason" : "resolutionMissReason";
    const reason = input.reason || null;
    if (existing[column] === reason) return existing;

    const updated = await tx
      .update(incident)
      .set({ [column]: reason, updatedAt: new Date() })
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
    // the column holds the current reason; the event keeps who wrote each version
    await appendIncidentEvent(tx, ctx, {
      incidentId: updated.id,
      type:
        input.kind === "response"
          ? "sla_response_miss_explained"
          : "sla_resolution_miss_explained",
      message: reason,
    });
    return updated;
  });
}
