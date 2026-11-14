import { and, eq } from "@openstatus/db";
import { incidentSlaPolicy, monitorSlaPolicy } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { withLatestTerms } from "../monitor-reporting/internal";
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

    const linked = await tx
      .select()
      .from(monitorSlaPolicy)
      .where(
        and(
          eq(monitorSlaPolicy.workspaceId, ctx.workspace.id),
          eq(monitorSlaPolicy.incidentSlaPolicyId, before.id),
        ),
      )
      .get();
    if (linked) {
      // the foreign key would clear it too, but without an audit row
      const [policyBefore, policyAfter] = await withLatestTerms(
        tx,
        ctx.workspace.id,
        [
          linked,
          await tx
            .update(monitorSlaPolicy)
            .set({ incidentSlaPolicyId: null, updatedAt: new Date() })
            .where(eq(monitorSlaPolicy.id, linked.id))
            .returning()
            .get(),
        ],
      );
      await emitAudit(tx, ctx, {
        action: "monitor_sla_policy.update",
        entityType: "monitor_sla_policy",
        entityId: linked.id,
        before: policyBefore,
        after: policyAfter,
      });
    }

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
