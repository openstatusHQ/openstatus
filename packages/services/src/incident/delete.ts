import { eq } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { getIncidentInWorkspace } from "./internal";
import { DeleteIncidentInput } from "./schemas";

export async function deleteIncident(args: {
  ctx: ServiceContext;
  input: DeleteIncidentInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = DeleteIncidentInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await tx.delete(incidentTable).where(eq(incidentTable.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "incident.delete",
      entityType: "incident",
      entityId: existing.id,
      before: existing,
    });
  });
}
