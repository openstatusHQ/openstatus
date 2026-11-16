import { and, eq } from "@openstatus/db";
import {
  uptimeTarget,
  uptimeTargetToMonitor,
  uptimeTargetSealedMonth,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { PreconditionFailedError } from "../errors";
import { findPolicy } from "./internal";
import { UptimeTargetIdInput } from "./schemas";

/** Only for a policy never sealed; a sealed month is a record and keeps its policy (archive instead). */
export async function deleteUptimeTarget(args: {
  ctx: ServiceContext;
  input: UptimeTargetIdInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = UptimeTargetIdInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const row = await findPolicy(tx, ctx, input.id);
    const sealed = await tx
      .select({ id: uptimeTargetSealedMonth.id })
      .from(uptimeTargetSealedMonth)
      .where(
        and(
          eq(uptimeTargetSealedMonth.uptimeTargetId, row.id),
          eq(uptimeTargetSealedMonth.workspaceId, ctx.workspace.id),
        ),
      )
      .limit(1)
      .get();
    if (sealed) {
      throw new PreconditionFailedError(
        "This uptime target has sealed months and cannot be deleted. Archive it instead.",
      );
    }

    const monitorIds = (
      await tx
        .select({ monitorId: uptimeTargetToMonitor.monitorId })
        .from(uptimeTargetToMonitor)
        .where(eq(uptimeTargetToMonitor.uptimeTargetId, row.id))
        .all()
    )
      .map((r) => r.monitorId)
      .sort((a, b) => a - b);
    await tx
      .delete(uptimeTargetToMonitor)
      .where(eq(uptimeTargetToMonitor.uptimeTargetId, row.id));
    await tx.delete(uptimeTarget).where(eq(uptimeTarget.id, row.id));
    await emitAudit(tx, ctx, {
      action: "uptime_target.delete",
      entityType: "uptime_target",
      entityId: row.id,
      before: { ...row, monitorIds },
    });
  });
}
