import { and, eq, inArray } from "@openstatus/db";
import { uptimeTarget, uptimeTargetToMonitor } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { PreconditionFailedError } from "../errors";
import {
  assertUptimeTargetLimit,
  getWritablePolicy,
  sealedMonthsOf,
  validatePolicyMonitorIds,
} from "./internal";
import { UpdateUptimeTargetInput } from "./schemas";

/** Target/strict judge every unsealed month at once; a sealed month keeps the terms it sealed with. */
export async function updateUptimeTarget(args: {
  ctx: ServiceContext;
  input: UpdateUptimeTargetInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = UpdateUptimeTargetInput.parse(args.input);
  assertUptimeTargetLimit(ctx);

  return withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const row = await getWritablePolicy(tx, ctx, input.id);

    const currentIds = (
      await tx
        .select({ monitorId: uptimeTargetToMonitor.monitorId })
        .from(uptimeTargetToMonitor)
        .where(eq(uptimeTargetToMonitor.uptimeTargetId, row.id))
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
      .update(uptimeTarget)
      .set({ name, timeZone, target, strict, updatedAt: new Date() })
      .where(eq(uptimeTarget.id, row.id))
      .returning()
      .get();
    if (removed.length > 0) {
      await tx
        .delete(uptimeTargetToMonitor)
        .where(
          and(
            eq(uptimeTargetToMonitor.uptimeTargetId, row.id),
            inArray(uptimeTargetToMonitor.monitorId, removed),
          ),
        );
    }
    if (added.length > 0) {
      await tx.insert(uptimeTargetToMonitor).values(
        added.map((monitorId) => ({
          uptimeTargetId: row.id,
          monitorId,
        })),
      );
    }

    const after = { ...updated, monitorIds: nextIds };
    await emitAudit(tx, ctx, {
      action: "uptime_target.update",
      entityType: "uptime_target",
      entityId: row.id,
      before,
      after,
    });
    return after;
  });
}
