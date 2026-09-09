import { and, eq, isNull } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError } from "../errors";
import type { Incident } from "../types";
import { getIncidentInWorkspace } from "./internal";
import { AcknowledgeIncidentInput } from "./schemas";

export async function acknowledgeIncident(args: {
  ctx: ServiceContext;
  input: AcknowledgeIncidentInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = AcknowledgeIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const before = await getIncidentInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    if (before.acknowledgedAt) {
      throw new ConflictError("Incident already acknowledged.");
    }

    const after = await tx
      .update(incidentTable)
      .set({
        acknowledgedAt: new Date(),
        acknowledgedBy: ctx.actor.type === "user" ? ctx.actor.userId : null,
        status: before.status === "triage" ? "investigating" : before.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(incidentTable.id, before.id),
          isNull(incidentTable.acknowledgedAt),
        ),
      )
      .returning()
      .get();

    if (!after) throw new ConflictError("Incident already acknowledged.");

    await emitAudit(tx, ctx, {
      action: "incident.acknowledge",
      entityType: "incident",
      entityId: after.id,
      before,
      after,
    });

    return after;
  });
}
