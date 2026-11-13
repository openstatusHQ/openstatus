import { and, eq, gt, inArray, ne } from "@openstatus/db";
import {
  monitorSlaPolicy,
  monitorSlaPolicyTerms,
  monitorSlaPolicyToMonitor,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { PreconditionFailedError } from "../errors";
import { monthRange } from "../frozen-uptime/compute";
import {
  assertMonitorSlaLimit,
  getWritablePolicy,
  latestTermsOf,
  sealedMonthsOf,
  termsForMonth,
  validatePolicyMonitorIds,
} from "./internal";
import { monthOf } from "./months";
import { UpdateMonitorSlaPolicyInput } from "./schemas";

/**
 * New target/strict apply from the next month in the policy's zone; previews
 * follow at once. Kept memberships keep their start for sealing.
 */
export async function updateMonitorSlaPolicy(args: {
  ctx: ServiceContext;
  input: UpdateMonitorSlaPolicyInput;
  now?: Date;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = UpdateMonitorSlaPolicyInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const now = args.now ?? new Date();

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
    const latest = (await latestTermsOf(tx, row.workspaceId, [row])).get(
      row.id,
    ) ?? { target: row.target, strict: row.strict, effectiveFrom: null };
    const before = {
      ...row,
      target: latest.target,
      strict: latest.strict,
      termsEffectiveFrom: latest.effectiveFrom,
      monitorIds: currentIds,
    };

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
    const target = input.target ?? latest.target;
    const strict = input.strict ?? latest.strict;
    const termsChanged = target !== latest.target || strict !== latest.strict;
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

    let termsEffectiveFrom = latest.effectiveFrom;
    if (termsChanged || zoneChanged) {
      const liveMonth = monthOf(now, timeZone);
      const nextMonth = monthOf(monthRange(liveMonth, timeZone).end, timeZone);
      // rows past the live month are pending; a zone change can move the live month either way
      const oldLiveMonth = monthOf(now, row.timeZone);
      const pendingAfter = oldLiveMonth < liveMonth ? oldLiveMonth : liveMonth;
      await tx
        .delete(monitorSlaPolicyTerms)
        .where(
          and(
            eq(monitorSlaPolicyTerms.monitorSlaPolicyId, row.id),
            gt(monitorSlaPolicyTerms.effectiveFrom, pendingAfter),
            ne(monitorSlaPolicyTerms.effectiveFrom, nextMonth),
          ),
        );
      const live = await termsForMonth(tx, row, liveMonth);
      if (live.target === target && live.strict === strict) {
        await tx
          .delete(monitorSlaPolicyTerms)
          .where(
            and(
              eq(monitorSlaPolicyTerms.monitorSlaPolicyId, row.id),
              eq(monitorSlaPolicyTerms.effectiveFrom, nextMonth),
            ),
          );
        termsEffectiveFrom = live.effectiveFrom;
      } else {
        await tx
          .insert(monitorSlaPolicyTerms)
          .values({
            workspaceId: row.workspaceId,
            monitorSlaPolicyId: row.id,
            target,
            strict,
            effectiveFrom: nextMonth,
          })
          .onConflictDoUpdate({
            target: [
              monitorSlaPolicyTerms.monitorSlaPolicyId,
              monitorSlaPolicyTerms.effectiveFrom,
            ],
            set: { target, strict },
          });
        termsEffectiveFrom = nextMonth;
      }
    }

    // target/strict on the row stay the terms before any terms row
    const updated = await tx
      .update(monitorSlaPolicy)
      .set({ name, timeZone, updatedAt: new Date() })
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

    const after = {
      ...updated,
      target,
      strict,
      termsEffectiveFrom,
      monitorIds: nextIds,
    };
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
