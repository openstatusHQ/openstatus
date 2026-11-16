import { and, asc, desc, eq, isNull } from "@openstatus/db";
import {
  uptimeTargetExcusedWindow,
  uptimeTarget,
  uptimeTargetToMonitor,
} from "@openstatus/db/src/schema";

import { loadAttributedUsers } from "../attribution";
import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { excusedWindowLock } from "./excused";
import type { UptimeEpisodesPipes } from "./fetch-episodes";
import {
  assertUptimeTargetLimit,
  excusedWindowMonitorIds,
  judgePolicyMonths,
  loadPolicyMembers,
  sealedMonthsOf,
} from "./internal";
import { completeMonths, LAST_TWELVE, monthOf, splitByMonth } from "./months";
import {
  GetUptimeTargetInput,
  ListUptimeTargetsForMonitorInput,
  UptimeTargetIdInput,
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
    .from(uptimeTargetExcusedWindow)
    .where(
      and(
        eq(uptimeTargetExcusedWindow.uptimeTargetId, policy.id),
        eq(uptimeTargetExcusedWindow.workspaceId, ctx.workspace.id),
      ),
    )
    .orderBy(
      desc(uptimeTargetExcusedWindow.from),
      desc(uptimeTargetExcusedWindow.id),
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
export async function getUptimeTargetSummary(args: {
  ctx: ServiceContext;
  input: UptimeTargetIdInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = UptimeTargetIdInput.parse(args.input);
  assertUptimeTargetLimit(ctx);
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
export async function getUptimeTarget(args: {
  ctx: ServiceContext;
  input: GetUptimeTargetInput;
  now?: Date;
  episodesPipes?: UptimeEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetUptimeTargetInput.parse(args.input);
  assertUptimeTargetLimit(ctx);
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

export type UptimeTargetDetail = Awaited<ReturnType<typeof getUptimeTarget>>;

/** Active policies covering a monitor; no months, no Tinybird. */
export async function listUptimeTargetsForMonitor(args: {
  ctx: ServiceContext;
  input: ListUptimeTargetsForMonitorInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = ListUptimeTargetsForMonitorInput.parse(args.input);
  assertUptimeTargetLimit(ctx);
  const db = getReadDb(ctx);
  return db
    .select({
      id: uptimeTarget.id,
      name: uptimeTarget.name,
      timeZone: uptimeTarget.timeZone,
      target: uptimeTarget.target,
      strict: uptimeTarget.strict,
    })
    .from(uptimeTargetToMonitor)
    .innerJoin(
      uptimeTarget,
      eq(uptimeTarget.id, uptimeTargetToMonitor.uptimeTargetId),
    )
    .where(
      and(
        eq(uptimeTargetToMonitor.monitorId, input.monitorId),
        eq(uptimeTarget.workspaceId, ctx.workspace.id),
        isNull(uptimeTarget.archivedAt),
      ),
    )
    .orderBy(asc(uptimeTarget.id))
    .all();
}
