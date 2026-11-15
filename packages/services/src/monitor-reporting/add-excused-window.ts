import { and, eq, inArray } from "@openstatus/db";
import {
  monitorSlaExcusedWindow,
  monitorSlaExcusedWindowToMonitor,
  monitorSlaPolicyToMonitor,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ValidationError } from "../errors";
import {
  assertExcusedWindowOpen,
  assertMonitorSlaLimit,
  getWritablePolicy,
} from "./internal";
import { AddMonitorReportingExcusedWindowInput } from "./schemas";

/** Runs inside the window stop counting for the picked members of the policy. */
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
    const members = await tx
      .select({ id: monitorSlaPolicyToMonitor.monitorId })
      .from(monitorSlaPolicyToMonitor)
      .where(
        and(
          eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, policy.id),
          inArray(monitorSlaPolicyToMonitor.monitorId, input.monitorIds),
        ),
      )
      .all();
    if (members.length !== input.monitorIds.length) {
      throw new ValidationError("Every monitor must be part of the reporting.");
    }

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
    await tx.insert(monitorSlaExcusedWindowToMonitor).values(
      input.monitorIds.map((monitorId) => ({
        monitorSlaExcusedWindowId: row.id,
        monitorId,
      })),
    );
    const created = { ...row, monitorIds: input.monitorIds };
    await emitAudit(tx, ctx, {
      action: "monitor_sla_excused_window.create",
      entityType: "monitor_sla_excused_window",
      entityId: row.id,
      after: created,
    });
    return created;
  });
}
