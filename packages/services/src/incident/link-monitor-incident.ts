import { and, eq } from "@openstatus/db";
import { monitorIncidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { getIncidentInWorkspace } from "./internal";
import { LinkMonitorIncidentInput } from "./schemas";

export async function linkMonitorIncident(args: {
  ctx: ServiceContext;
  input: LinkMonitorIncidentInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = LinkMonitorIncidentInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const incident = await getIncidentInWorkspace({
      tx,
      id: input.incidentId,
      workspaceId: ctx.workspace.id,
    });

    const before = await tx
      .select()
      .from(monitorIncidentTable)
      .where(
        and(
          eq(monitorIncidentTable.id, input.monitorIncidentId),
          eq(monitorIncidentTable.workspaceId, ctx.workspace.id),
        ),
      )
      .get();

    if (!before) {
      throw new NotFoundError("monitor incident", input.monitorIncidentId);
    }

    const after = await tx
      .update(monitorIncidentTable)
      .set({ incidentId: incident.id, updatedAt: new Date() })
      .where(eq(monitorIncidentTable.id, before.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "monitor_incident.update",
      entityType: "monitor_incident",
      entityId: after.id,
      before,
      after,
    });
  });
}
