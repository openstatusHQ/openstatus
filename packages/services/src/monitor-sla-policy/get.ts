import { and, asc, desc, eq, isNull } from "@openstatus/db";
import {
  monitorSlaExcusedWindow,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
} from "@openstatus/db/src/schema";

import { loadAttributedUsers } from "../attribution";
import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import type { UptimeRunsRangePipes } from "../frozen-uptime/run";
import { excusedWindowLock } from "./excused";
import type { SlaEpisodesPipes } from "./fetch-episodes";
import {
  assertMonitorSlaLimit,
  judgePolicyMonths,
  loadPolicyMembers,
  loadTermsHistory,
  sealedMonthsOf,
  termsStateOf,
} from "./internal";
import { completeMonths, LAST_TWELVE, monthOf, splitByMonth } from "./months";
import {
  GetMonitorSlaPolicyInput,
  ListMonitorSlaPoliciesForMonitorInput,
  MonitorSlaPolicyIdInput,
} from "./schemas";

/** The policy's excused windows, newest first, with the months they touch and whether they are locked. */
async function loadExcusedWindows(
  ctx: ServiceContext,
  policy: { id: number; workspaceId: number; timeZone: string },
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
    months: splitByMonth(w.from.getTime(), w.to.getTime(), policy.timeZone).map(
      (p) => p.month,
    ),
    locked: excusedWindowLock(w, { now, sealed, timeZone: policy.timeZone }),
  }));
}

/**
 * A policy's latest terms and current members, archived or not; no months, no
 * Tinybird. `liveTerms` judge the running month `liveMonth`; `pendingTerms` follow.
 */
export async function getMonitorSlaPolicySummary(args: {
  ctx: ServiceContext;
  input: MonitorSlaPolicyIdInput;
  now?: Date;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = MonitorSlaPolicyIdInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const db = getReadDb(ctx);
  const { policy, monitors, history } = await loadPolicyMembers(ctx, input.id);
  return {
    ...policy,
    ...termsStateOf(history, policy, args.now ?? new Date()),
    /** the time zone is locked once any month is sealed */
    sealed: (await sealedMonthsOf(db, policy)).length > 0,
    monitors: monitors.map(
      ({ regions: _r, periodicity: _p, memberSince: _m, ...m }) => m,
    ),
  };
}

/**
 * A policy with each monitor's months in its time zone: sealed months as
 * stored, the running and previous month on episodes, older ones as previews.
 */
export async function getMonitorSlaPolicy(args: {
  ctx: ServiceContext;
  input: GetMonitorSlaPolicyInput;
  now?: Date;
  episodesPipes?: SlaEpisodesPipes;
  runsRangePipes?: UptimeRunsRangePipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMonitorSlaPolicyInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const { policy, monitors, history } = await loadPolicyMembers(ctx, input.id);

  const now = args.now ?? new Date();
  const complete = completeMonths(now, input.months, policy.timeZone);
  const months = [...complete, monthOf(now, policy.timeZone)];
  const lastTwelve = new Set(complete.slice(-LAST_TWELVE));
  const judged = await judgePolicyMonths({
    ctx,
    policy,
    monitors,
    months,
    now,
    live: true,
    episodesPipes: args.episodesPipes,
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
    ...termsStateOf(history, policy, now),
    months,
    monitors: rows,
    excusedWindows: await loadExcusedWindows(ctx, policy, now),
    /** episodes failed to load for some monitor: recent months may be incomplete */
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

/** Active policies covering a monitor with their running and pending terms; no months, no Tinybird. */
export async function listMonitorSlaPoliciesForMonitor(args: {
  ctx: ServiceContext;
  input: ListMonitorSlaPoliciesForMonitorInput;
  now?: Date;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = ListMonitorSlaPoliciesForMonitorInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const db = getReadDb(ctx);
  const rows = await db
    .select({
      id: monitorSlaPolicy.id,
      workspaceId: monitorSlaPolicy.workspaceId,
      name: monitorSlaPolicy.name,
      timeZone: monitorSlaPolicy.timeZone,
      target: monitorSlaPolicy.target,
      strict: monitorSlaPolicy.strict,
    })
    .from(monitorSlaPolicyToMonitor)
    .innerJoin(
      monitorSlaPolicy,
      eq(monitorSlaPolicy.id, monitorSlaPolicyToMonitor.monitorSlaPolicyId),
    )
    .where(
      and(
        eq(monitorSlaPolicyToMonitor.monitorId, input.monitorId),
        eq(monitorSlaPolicy.workspaceId, ctx.workspace.id),
        isNull(monitorSlaPolicy.archivedAt),
      ),
    )
    .orderBy(asc(monitorSlaPolicy.id))
    .all();
  const history = await loadTermsHistory(db, ctx.workspace.id, rows);
  const now = args.now ?? new Date();
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    timeZone: p.timeZone,
    ...termsStateOf(history, p, now),
  }));
}
