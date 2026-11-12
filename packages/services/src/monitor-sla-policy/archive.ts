import { eq } from "@openstatus/db";
import { monitorSlaPolicy } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { findPolicy } from "./internal";
import { MonitorSlaPolicyIdInput } from "./schemas";

/** Read-only from now on and no longer sealed. No limit check: a downgraded workspace must be able to tidy up. */
export async function archiveMonitorSlaPolicy(args: {
  ctx: ServiceContext;
  input: MonitorSlaPolicyIdInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = MonitorSlaPolicyIdInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const before = await findPolicy(tx, ctx, input.id);
    if (before.archivedAt) return before;

    const after = await tx
      .update(monitorSlaPolicy)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(monitorSlaPolicy.id, before.id))
      .returning()
      .get();
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
