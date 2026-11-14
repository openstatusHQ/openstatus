import { eq } from "@openstatus/db";
import { monitorSlaPolicy } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { findPolicy, withLatestTerms } from "./internal";
import { MonitorReportingIdInput } from "./schemas";

/** Read-only from now on and no longer sealed. No limit check: a downgraded workspace must be able to tidy up. */
export async function archiveMonitorReporting(args: {
  ctx: ServiceContext;
  input: MonitorReportingIdInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = MonitorReportingIdInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const [before] = await withLatestTerms(tx, ctx.workspace.id, [
      await findPolicy(tx, ctx, input.id),
    ]);
    if (before.archivedAt) return before;

    const [after] = await withLatestTerms(tx, ctx.workspace.id, [
      await tx
        .update(monitorSlaPolicy)
        // an archived policy is read-only, so it must not keep the one link
        .set({
          archivedAt: new Date(),
          incidentSlaPolicyId: null,
          updatedAt: new Date(),
        })
        .where(eq(monitorSlaPolicy.id, before.id))
        .returning()
        .get(),
    ]);
    await emitAudit(tx, ctx, {
      action: "monitor_sla_policy.update",
      entityType: "monitor_sla_policy",
      entityId: before.id,
      before,
      after,
    });
    return after;
  });
}
