import { and, eq, inArray } from "@openstatus/db";
import {
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { PreconditionFailedError } from "../errors";
import {
  assertMonitorSlaLimit,
  getWritablePolicy,
  sealedMonthsOf,
  validatePolicyMonitorIds,
} from "./internal";
import { UpdateMonitorReportingInput } from "./schemas";

/** Target/strict judge every unsealed month at once; a sealed month keeps the terms it sealed with. */
export async function updateMonitorReporting(args: {
  ctx: ServiceContext;
  input: UpdateMonitorReportingInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = UpdateMonitorReportingInput.parse(args.input);
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
    const timeZone = input.timeZone ?? row.timeZone;
    const target = input.target ?? row.target;
    const strict = input.strict ?? row.strict;
    const termsChanged = target !== row.target || strict !== row.strict;
    const zoneChanged = timeZone !== row.timeZone;
    const unchanged =
      name === row.name &&
      !zoneChanged &&
      !termsChanged &&
      added.length === 0 &&
      removed.length === 0;
    if (unchanged) return before;

    if (zoneChanged && (await sealedMonthsOf(tx, row)).length > 0) {
      throw new PreconditionFailedError(
        "The time zone is locked once a month is sealed.",
      );
    }

    const updated = await tx
      .update(monitorSlaPolicy)
      .set({ name, timeZone, target, strict, updatedAt: new Date() })
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
