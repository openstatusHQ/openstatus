import { eq } from "@openstatus/db";
import { incidentResponseTarget } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { assertNotKeyActor, findIncidentResponseTarget } from "./internal";

/** Turns the policy off. No limit check: a downgraded workspace must be able to remove it. */
export async function deleteIncidentResponseTarget(args: {
  ctx: ServiceContext;
}) {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  assertNotKeyActor(ctx);

  await withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const before = await findIncidentResponseTarget(tx, ctx.workspace.id);
    if (!before) throw new NotFoundError("incident_response_target");

    await tx
      .delete(incidentResponseTarget)
      .where(eq(incidentResponseTarget.id, before.id));
    await emitAudit(tx, ctx, {
      action: "incident_response_target.delete",
      entityType: "incident_response_target",
      entityId: before.id,
      before,
    });
  });
}
