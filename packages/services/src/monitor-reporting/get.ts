import { and, asc, desc, eq, isNull } from "@openstatus/db";
import {
  monitorSlaExcusedWindow,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
} from "@openstatus/db/src/schema";

import { loadAttributedUsers } from "../attribution";
import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { excusedWindowLock } from "./excused";
import type { SlaEpisodesPipes } from "./fetch-episodes";
import {
  assertMonitorSlaLimit,
  excusedWindowMonitorIds,
  judgePolicyMonths,
  loadPolicyMembers,
  sealedMonthsOf,
} from "./internal";
import { completeMonths, LAST_TWELVE, monthOf, splitByMonth } from "./months";
import {
  GetMonitorReportingInput,
  ListMonitorReportingsForMonitorInput,
  MonitorReportingIdInput,
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
  const [sealed, users, monitorsOf] = await Promise.all([
    sealedMonthsOf(db, policy),
    loadAttributedUsers(
      db,
      rows.map((r) => r.createdBy),
    ),
    excusedWindowMonitorIds(
      db,
      rows.map((r) => r.id),
    ),
  ]);
  return rows.map(({ workspaceId: _, createdBy, ...w }) => ({
    ...w,
    monitorIds: monitorsOf.get(w.id) ?? [],
    createdBy: createdBy === null ? null : (users.get(createdBy) ?? null),
    months: splitByMonth(w.from.getTime(), w.to.getTime(), policy.timeZone).map(
      (p) => p.month,
    ),
    locked: excusedWindowLock(w, { now, sealed, timeZone: policy.timeZone }),
  }));
}

/** A policy and its current members, archived or not; no months, no Tinybird. */
export async function getMonitorReportingSummary(args: {
  ctx: ServiceContext;
  input: MonitorReportingIdInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = MonitorReportingIdInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const db = getReadDb(ctx);
  const { policy, monitors } = await loadPolicyMembers(ctx, input.id);
  return {
    ...policy,
    /** the time zone is locked once any month is sealed */
    sealed: (await sealedMonthsOf(db, policy)).length > 0,
    monitors: monitors.map(
      ({ regions: _r, periodicity: _p, memberSince: _m, ...m }) => m,
    ),
  };
}

/**
 * A policy with each monitor's months in its time zone: sealed months as
 * stored, the running and previous month on episodes, older ones empty.
 */
export async function getMonitorReporting(args: {
  ctx: ServiceContext;
  input: GetMonitorReportingInput;
  now?: Date;
  episodesPipes?: SlaEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMonitorReportingInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const { policy, monitors } = await loadPolicyMembers(ctx, input.id);

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
    /** episodes failed to load for some monitor: recent months may be incomplete */
    liveIncomplete: judged.liveIncomplete,
    missed: {
      months: missedMonths.size,
      previews: missedMonths.size - sealedMissMonths.size,
      of: LAST_TWELVE,
    },
  };
}

export type MonitorReportingDetail = Awaited<
  ReturnType<typeof getMonitorReporting>
>;

/** Active policies covering a monitor; no months, no Tinybird. */
export async function listMonitorReportingsForMonitor(args: {
  ctx: ServiceContext;
  input: ListMonitorReportingsForMonitorInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = ListMonitorReportingsForMonitorInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const db = getReadDb(ctx);
  return db
    .select({
      id: monitorSlaPolicy.id,
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
}
