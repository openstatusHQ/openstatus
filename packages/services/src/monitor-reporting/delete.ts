import { and, eq } from "@openstatus/db";
import {
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedMonth,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { PreconditionFailedError } from "../errors";
import { findPolicy, withLatestTerms } from "./internal";
import { MonitorReportingIdInput } from "./schemas";

/** Only for a policy never sealed; a sealed month is a record and keeps its policy (archive instead). */
export async function deleteMonitorReporting(args: {
  ctx: ServiceContext;
  input: MonitorReportingIdInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = MonitorReportingIdInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const [row] = await withLatestTerms(tx, ctx.workspace.id, [
      await findPolicy(tx, ctx, input.id),
    ]);
    const sealed = await tx
      .select({ id: monitorSlaSealedMonth.id })
      .from(monitorSlaSealedMonth)
      .where(
        and(
          eq(monitorSlaSealedMonth.monitorSlaPolicyId, row.id),
          eq(monitorSlaSealedMonth.workspaceId, ctx.workspace.id),
        ),
      )
      .limit(1)
      .get();
    if (sealed) {
      throw new PreconditionFailedError(
        "This reporting has sealed months and cannot be deleted. Archive it instead.",
      );
    }

    const monitorIds = (
      await tx
        .select({ monitorId: monitorSlaPolicyToMonitor.monitorId })
        .from(monitorSlaPolicyToMonitor)
        .where(eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, row.id))
        .all()
    )
      .map((r) => r.monitorId)
      .sort((a, b) => a - b);
    await tx
      .delete(monitorSlaPolicyToMonitor)
      .where(eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, row.id));
    await tx.delete(monitorSlaPolicy).where(eq(monitorSlaPolicy.id, row.id));
    await emitAudit(tx, ctx, {
      action: "monitor_sla_policy.delete",
      entityType: "monitor_sla_policy",
      entityId: row.id,
      before: { ...row, monitorIds },
    });
  });
}
