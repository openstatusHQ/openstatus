import { eq } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ConflictError, InternalServiceError } from "../errors";
import type { Incident } from "../types";
import { getIncidentInWorkspace } from "./internal";
import { AcknowledgeIncidentInput } from "./schemas";

export async function acknowledgeIncident(args: {
  ctx: ServiceContext;
  input: AcknowledgeIncidentInput;
}): Promise<Incident> {
  const { ctx } = args;
  const input = AcknowledgeIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    if (existing.acknowledgedAt) {
      throw new ConflictError("Incident already acknowledged.");
    }

    const now = new Date();
    const updated = await tx
      .update(incidentTable)
      .set({
        acknowledgedAt: now,
        acknowledgedBy: tryGetActorUserId(ctx.actor),
        updatedAt: now,
      })
      .where(eq(incidentTable.id, existing.id))
      .returning()
      .get();
    if (!updated) {
      throw new InternalServiceError(
        `failed to acknowledge incident ${existing.id}`,
      );
    }

    await emitAudit(tx, ctx, {
      action: "incident.acknowledge",
      entityType: "incident",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
