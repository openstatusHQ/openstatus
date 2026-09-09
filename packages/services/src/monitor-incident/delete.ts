import { eq } from "@openstatus/db";
import { monitorIncidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { getMonitorIncidentInWorkspace } from "./internal";
import { DeleteMonitorIncidentInput } from "./schemas";

export async function deleteMonitorIncident(args: {
  ctx: ServiceContext;
  input: DeleteMonitorIncidentInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = DeleteMonitorIncidentInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getMonitorIncidentInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await tx
      .delete(monitorIncidentTable)
      .where(eq(monitorIncidentTable.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "monitor_incident.delete",
      entityType: "monitor_incident",
      entityId: existing.id,
      before: existing,
    });
  });
}
