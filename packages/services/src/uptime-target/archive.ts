import { eq } from "@openstatus/db";
import { uptimeTarget } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { findPolicy } from "./internal";
import { UptimeTargetIdInput } from "./schemas";

/** Read-only from now on and no longer sealed. No limit check: a downgraded workspace must be able to tidy up. */
export async function archiveUptimeTarget(args: {
  ctx: ServiceContext;
  input: UptimeTargetIdInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = UptimeTargetIdInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const before = await findPolicy(tx, ctx, input.id);
    if (before.archivedAt) return before;

    const after = await tx
      .update(uptimeTarget)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(uptimeTarget.id, before.id))
      .returning()
      .get();
    await emitAudit(tx, ctx, {
      action: "uptime_target.update",
      entityType: "uptime_target",
      entityId: before.id,
      before,
      after,
    });
    return after;
  });
}
