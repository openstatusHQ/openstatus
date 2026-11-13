import { monitorSlaExcusedWindow } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import {
  assertExcusedWindowOpen,
  assertMonitorSlaLimit,
  getWritablePolicy,
} from "./internal";
import { AddMonitorReportingExcusedWindowInput } from "./schemas";

/** Runs inside the window stop counting for every monitor of the policy. */
export async function addMonitorReportingExcusedWindow(args: {
  ctx: ServiceContext;
  input: AddMonitorReportingExcusedWindowInput;
  now?: Date;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = AddMonitorReportingExcusedWindowInput.parse(args.input);
  assertMonitorSlaLimit(ctx);

  return withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const policy = await getWritablePolicy(tx, ctx, input.policyId);
    await assertExcusedWindowOpen(tx, policy, input, args.now ?? new Date());

    const row = await tx
      .insert(monitorSlaExcusedWindow)
      .values({
        workspaceId: ctx.workspace.id,
        monitorSlaPolicyId: policy.id,
        kind: input.kind,
        reason: input.reason,
        from: input.from,
        to: input.to,
        createdBy: tryGetActorUserId(ctx.actor),
      })
      .returning()
      .get();
    await emitAudit(tx, ctx, {
      action: "monitor_sla_excused_window.create",
      entityType: "monitor_sla_excused_window",
      entityId: row.id,
      after: row,
    });
    return row;
  });
}
