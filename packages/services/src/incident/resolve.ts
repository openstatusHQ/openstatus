import { and, eq, isNull } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError } from "../errors";
import type { Incident } from "../types";
import { getIncidentInWorkspace } from "./internal";
import { ResolveIncidentInput } from "./schemas";

export async function resolveIncident(args: {
  ctx: ServiceContext;
  input: ResolveIncidentInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = ResolveIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const before = await getIncidentInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    if (before.resolvedAt) {
      throw new ConflictError("Incident already resolved.");
    }

    const after = await tx
      .update(incidentTable)
      .set({
        resolvedAt: new Date(),
        resolvedBy: ctx.actor.type === "user" ? ctx.actor.userId : null,
        status: "resolved",
        autoResolved: false,
        updatedAt: new Date(),
      })
      .where(
        and(eq(incidentTable.id, before.id), isNull(incidentTable.resolvedAt)),
      )
      .returning()
      .get();

    if (!after) throw new ConflictError("Incident already resolved.");

    await emitAudit(tx, ctx, {
      action: "incident.resolve",
      entityType: "incident",
      entityId: after.id,
      before,
      after,
    });

    return after;
  });
}
