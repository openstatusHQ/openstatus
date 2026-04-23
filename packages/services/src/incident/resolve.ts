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
import { ResolveIncidentInput } from "./schemas";

export async function resolveIncident(args: {
  ctx: ServiceContext;
  input: ResolveIncidentInput;
}): Promise<Incident> {
  const { ctx } = args;
  const input = ResolveIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    if (existing.resolvedAt) {
      throw new ConflictError("Incident already resolved.");
    }

    const now = new Date();
    const updated = await tx
      .update(incidentTable)
      .set({
        resolvedAt: now,
        resolvedBy: tryGetActorUserId(ctx.actor),
        updatedAt: now,
      })
      .where(eq(incidentTable.id, existing.id))
      .returning()
      .get();
    if (!updated) {
      throw new InternalServiceError(
        `failed to resolve incident ${existing.id}`,
      );
    }

    await emitAudit(tx, ctx, {
      action: "incident.resolve",
      entityType: "incident",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
