import { and, desc, eq } from "@openstatus/db";
import { monitorSlaExcusedWindow } from "@openstatus/db/src/schema";

import { loadAttributedUsers } from "../attribution";
import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import type {
  UptimeRunsPipes,
  UptimeRunsRangePipes,
} from "../frozen-uptime/run";
import { excusedWindowLock } from "./excused";
import {
  assertMonitorSlaLimit,
  judgePolicyMonths,
  loadPolicyMembers,
  sealedMonthsOf,
} from "./internal";
import { completeMonths, LAST_TWELVE, monthOf, splitByMonth } from "./months";
import { GetMonitorSlaPolicyInput, MonitorSlaPolicyIdInput } from "./schemas";

/** The policy's excused windows, newest first, with the months they touch and whether they are locked. */
async function loadExcusedWindows(
  ctx: ServiceContext,
  policy: { id: number; workspaceId: number },
  now: Date,
) {
  const db = getReadDb(ctx);
  const rows = await db
    .select()
    .from(monitorSlaExcusedWindow)
    .where(
      and(
        eq(monitorSlaExcusedWindow.monitorSlaPolicyId, policy.id),
        eq(monitorSlaExcusedWindow.workspaceId, ctx.workspace.id),
      ),
    )
    .orderBy(
      desc(monitorSlaExcusedWindow.from),
      desc(monitorSlaExcusedWindow.id),
    )
    .all();
  if (rows.length === 0) return [];
  const sealed = await sealedMonthsOf(db, policy);
  const users = await loadAttributedUsers(
    db,
    rows.map((r) => r.createdBy),
  );
  return rows.map(({ workspaceId: _, createdBy, ...w }) => ({
    ...w,
    createdBy: createdBy === null ? null : (users.get(createdBy) ?? null),
    months: splitByMonth(w.from.getTime(), w.to.getTime()).map((p) => p.month),
    locked: excusedWindowLock(w, { now, sealed }),
  }));
}

/** A policy's terms and current members, archived or not; no months, no Tinybird. */
export async function getMonitorSlaPolicySummary(args: {
  ctx: ServiceContext;
  input: MonitorSlaPolicyIdInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = MonitorSlaPolicyIdInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const { policy, monitors } = await loadPolicyMembers(ctx, input.id);
  return {
    ...policy,
    monitors: monitors.map(({ regions: _, ...m }) => m),
  };
}

/**
 * A policy with each monitor's months judged against today's terms, plus the
 * running month (and the previous one until it is frozen) as live months.
 */
export async function getMonitorSlaPolicy(args: {
  ctx: ServiceContext;
  input: GetMonitorSlaPolicyInput;
  now?: Date;
  runsPipes?: UptimeRunsPipes;
  runsRangePipes?: UptimeRunsRangePipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMonitorSlaPolicyInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const { policy, monitors } = await loadPolicyMembers(ctx, input.id);

  const now = args.now ?? new Date();
  const complete = completeMonths(now, input.months);
  const months = [...complete, monthOf(now)];
  const lastTwelve = new Set(complete.slice(-LAST_TWELVE));
  const judged = await judgePolicyMonths({
    ctx,
    policy,
    monitors,
    months,
    now,
    live: true,
    runsPipes: args.runsPipes,
    runsRangePipes: args.runsRangePipes,
    sleep: args.sleep,
  });

  const missedMonths = new Set<string>();
  // a month with any sealed miss is settled, whatever its preview cells say
  const sealedMissMonths = new Set<string>();
  const rows = judged.monitors.map((m) => {
    const missed = m.months.filter(
      (mm) =>
        mm.met === false && mm.state !== "live" && lastTwelve.has(mm.month),
    );
    for (const mm of missed) {
      if (mm.state === "sealed") sealedMissMonths.add(mm.month);
      missedMonths.add(mm.month);
    }
    return {
      ...m,
      missed: {
        months: missed.length,
        previews: missed.filter((mm) => mm.state === "preview").length,
      },
    };
  });

  return {
    ...policy,
    months,
    monitors: rows,
    excusedWindows: await loadExcusedWindows(ctx, policy, now),
    /** run counts failed to load for some monitor: recent months may be incomplete */
    liveIncomplete: judged.liveIncomplete,
    excusedExpired: judged.excusedExpired,
    missed: {
      months: missedMonths.size,
      previews: missedMonths.size - sealedMissMonths.size,
      of: LAST_TWELVE,
    },
  };
}

export type MonitorSlaPolicyDetail = Awaited<
  ReturnType<typeof getMonitorSlaPolicy>
>;
