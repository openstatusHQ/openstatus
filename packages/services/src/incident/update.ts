import { and, eq } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import type { Incident } from "../types";
import { getIncidentInWorkspace } from "./internal";
import { UpdateIncidentInput } from "./schemas";

export async function updateIncident(args: {
  ctx: ServiceContext;
  input: UpdateIncidentInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdateIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const before = await getIncidentInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const after = await tx
      .update(incidentTable)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.severity !== undefined ? { severity: input.severity } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(incidentTable.id, before.id),
          eq(incidentTable.workspaceId, ctx.workspace.id),
        ),
      )
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "incident.update",
      entityType: "incident",
      entityId: after.id,
      before,
      after,
    });

    return after;
  });
}
