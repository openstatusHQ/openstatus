import { eq } from "@openstatus/db";
import { incidentSlaPolicy } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { assertNotKeyActor, findIncidentReporting } from "./internal";

/** Turns the policy off. No limit check: a downgraded workspace must be able to remove it. */
export async function deleteIncidentReporting(args: { ctx: ServiceContext }) {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  assertNotKeyActor(ctx);

  await withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const before = await findIncidentReporting(tx, ctx.workspace.id);
    if (!before) throw new NotFoundError("incident_sla_policy");

    await tx
      .delete(incidentSlaPolicy)
      .where(eq(incidentSlaPolicy.id, before.id));
    await emitAudit(tx, ctx, {
      action: "incident_sla_policy.delete",
      entityType: "incident_sla_policy",
      entityId: before.id,
      before,
    });
  });
}
