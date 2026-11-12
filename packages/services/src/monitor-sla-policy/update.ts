import { and, eq, inArray } from "@openstatus/db";
import {
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import {
  assertMonitorSlaLimit,
  getWritablePolicy,
  validatePolicyMonitorIds,
} from "./internal";
import { UpdateMonitorSlaPolicyInput } from "./schemas";

/** Previews follow at once; kept memberships keep their start for sealing. */
export async function updateMonitorSlaPolicy(args: {
  ctx: ServiceContext;
  input: UpdateMonitorSlaPolicyInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = UpdateMonitorSlaPolicyInput.parse(args.input);
  assertMonitorSlaLimit(ctx);

  return withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const row = await getWritablePolicy(tx, ctx, input.id);

    const currentIds = (
      await tx
        .select({ monitorId: monitorSlaPolicyToMonitor.monitorId })
        .from(monitorSlaPolicyToMonitor)
        .where(eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, row.id))
        .all()
    )
      .map((r) => r.monitorId)
      .sort((a, b) => a - b);
    const before = { ...row, monitorIds: currentIds };

    const nextIds = input.monitorIds
      ? Array.from(new Set(input.monitorIds)).sort((a, b) => a - b)
      : currentIds;
    const added = nextIds.filter((id) => !currentIds.includes(id));
    const removed = currentIds.filter((id) => !nextIds.includes(id));
    // members already in the policy stay, even if they became ineligible since
    await validatePolicyMonitorIds({
      tx,
      workspaceId: ctx.workspace.id,
      monitorIds: added,
    });

    const name = input.name ?? row.name;
    const target = input.target ?? row.target;
    const strict = input.strict ?? row.strict;
    const unchanged =
      name === row.name &&
      target === row.target &&
      strict === row.strict &&
      added.length === 0 &&
      removed.length === 0;
    if (unchanged) return before;

    const updated = await tx
      .update(monitorSlaPolicy)
      .set({ name, target, strict, updatedAt: new Date() })
      .where(eq(monitorSlaPolicy.id, row.id))
      .returning()
      .get();
    if (removed.length > 0) {
      await tx
        .delete(monitorSlaPolicyToMonitor)
        .where(
          and(
            eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, row.id),
            inArray(monitorSlaPolicyToMonitor.monitorId, removed),
          ),
        );
    }
    if (added.length > 0) {
      await tx.insert(monitorSlaPolicyToMonitor).values(
        added.map((monitorId) => ({
          monitorSlaPolicyId: row.id,
          monitorId,
        })),
      );
    }

    const after = { ...updated, monitorIds: nextIds };
    await emitAudit(tx, ctx, {
      action: "monitor_sla_policy.update",
      entityType: "monitor_sla_policy",
      entityId: row.id,
      before,
      after,
    });
    return after;
  });
}
