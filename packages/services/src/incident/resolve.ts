import { and, eq, isNull } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ConflictError } from "../errors";
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
    // Conditional update — atomically flips `resolved_at` only while it is
    // still NULL. Concurrent resolvers lose the race and get a no-row
    // return, which we translate into the same `ConflictError`.
    const updated = await tx
      .update(incidentTable)
      .set({
        resolvedAt: now,
        resolvedBy: tryGetActorUserId(ctx.actor),
        updatedAt: now,
      })
      .where(
        and(
          eq(incidentTable.id, existing.id),
          isNull(incidentTable.resolvedAt),
        ),
      )
      .returning()
      .get();
    if (!updated) {
      throw new ConflictError("Incident already resolved.");
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
