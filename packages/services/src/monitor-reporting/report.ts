import { and, asc, eq, gt, inArray, lt } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitorSlaExcusedWindow,
  monitorSlaSealedMonth,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import type { MonitorSlaExcusedWindowKind } from "@openstatus/db/src/schema/monitor_sla_policies/constants";

import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { ValidationError } from "../errors";
import { monthRange } from "../frozen-uptime/compute";
import { MONITOR_SLA_METHOD } from "./export";
import type { SlaEpisodesPipes } from "./fetch-episodes";
import {
  assertMonitorSlaLimit,
  judgePolicyMonths,
  loadPolicyMembers,
  termsForMonth,
} from "./internal";
import { getMonitorReportingMonth } from "./monitor-month";
import {
  LAST_TWELVE,
  liveUntilFrozen,
  type MonitorSlaMonth,
  monthOf,
  monthsBetween,
} from "./months";
import { GetMonitorReportingReportInput } from "./schemas";
import { SEAL_DELAY_MS } from "./seal";

/** Downtime stretches listed in full; the CSV export has the rest. */
export const REPORT_DOWNTIME_MAX = 25;

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 10);
}

function clippedMs(
  from: number,
  to: number,
  range: { start: number; end: number },
) {
  return Math.max(0, Math.min(to, range.end) - Math.max(from, range.start));
}

/**
 * A reporting's report for one complete month: the terms the month was judged
 * with, each member's result, downtime, excused windows, maintenances and the
 * rolling miss count. Final once every member that covered the month is sealed.
 */
export async function getMonitorReportingReport(args: {
  ctx: ServiceContext;
  input: GetMonitorReportingReportInput;
  now?: Date;
  episodesPipes?: SlaEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMonitorReportingReportInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const db = getReadDb(ctx);
  const { policy, monitors } = await loadPolicyMembers(ctx, input.id);

  const now = args.now ?? new Date();
  const { timeZone } = policy;
  const month = `${input.month}-01`;
  if (month >= monthOf(now, timeZone)) {
    throw new ValidationError("Only a month that has ended can be reported.");
  }
  const range = monthRange(month, timeZone);
  // a monitor added after the month ended was never part of it
  const members = monitors.filter(
    (m) => new Date(m.memberSince).getTime() < range.end,
  );
  const memberIds = members.map((m) => m.id);

  const [sealRows, cells] = await Promise.all([
    memberIds.length === 0
      ? []
      : db
          .select()
          .from(monitorSlaSealedMonth)
          .where(
            and(
              eq(monitorSlaSealedMonth.monitorSlaPolicyId, policy.id),
              eq(monitorSlaSealedMonth.workspaceId, ctx.workspace.id),
              eq(monitorSlaSealedMonth.month, month),
              inArray(monitorSlaSealedMonth.monitorId, memberIds),
            ),
          )
          .all(),
    Promise.all(
      members.map((m) =>
        getMonitorReportingMonth({
          ctx,
          input: { id: policy.id, monitorId: m.id, month: input.month },
          now,
          episodesPipes: args.episodesPipes,
          sleep: args.sleep,
        }),
      ),
    ),
  ]);
  const seals = new Map(sealRows.map((s) => [s.monitorId, s]));
  const final = members.length > 0 && members.every((m) => seals.has(m.id));

  const firstSeal = sealRows[0];
  const terms = firstSeal
    ? {
        target: firstSeal.target,
        strict: firstSeal.strict,
        creditSchedule: firstSeal.creditSchedule,
      }
    : await termsForMonth(db, policy, month).then((t) => ({
        target: t.target,
        strict: t.strict,
        creditSchedule: t.creditSchedule,
      }));

  const expectedAt = new Date(range.end + SEAL_DELAY_MS);
  const provisional = final
    ? null
    : liveUntilFrozen(month, now, timeZone)
      ? {
          reason:
            now < expectedAt ? ("pending" as const) : ("overdue" as const),
          expectedAt,
        }
      : { reason: "unsealed" as const, expectedAt: null };

  const rows = cells.map((cell, i) => {
    const episodes = cell.episodes ?? [];
    return {
      id: cell.monitor.id,
      name: cell.monitor.name,
      url: members[i].url,
      state: cell.state,
      uptime: cell.uptime,
      met: cell.met,
      coverage: cell.coverage,
      measuredMs: cell.measuredMs,
      downMs: cell.downMs,
      slowMs: cell.episodes
        ? episodes
            .filter((e) => e.kind === "degraded" && e.treatment !== "excused")
            .reduce((sum, e) => sum + e.weightedMs, 0)
        : null,
      excusedMs: cell.excusedMs,
      unmeasuredMs: cell.unmeasuredMs,
      credit: cell.credit,
      maintenanceMode: cell.maintenanceMode,
      episodesUnavailable: cell.episodesUnavailable,
    };
  });

  const stretches = cells
    .flatMap((cell) =>
      (cell.episodes ?? []).flatMap((e) =>
        (e.kind === "error" || e.kind === "degraded") &&
        (e.treatment === "counted" || e.treatment === "lenient")
          ? [
              {
                monitor: { id: cell.monitor.id, name: cell.monitor.name },
                kind: e.kind,
                treatment: e.treatment,
                startedAt: new Date(e.startedAt),
                endedAt: new Date(e.endedAt),
                durationMs: e.endedAt - e.startedAt,
              },
            ]
          : [],
      ),
    )
    .sort(
      (a, b) =>
        b.durationMs - a.durationMs ||
        a.startedAt.getTime() - b.startedAt.getTime(),
    );

  const [excusedWindows, maintenances, missed] = await Promise.all([
    reportExcusedWindows({ ctx, policyId: policy.id, final, sealRows, range }),
    reportMaintenances({ ctx, members: rows, range }),
    rollingMisses({ ctx, policy, members, month, now, cells }),
  ]);

  return {
    workspace: { name: ctx.workspace.name, slug: ctx.workspace.slug },
    policy: {
      id: policy.id,
      name: policy.name,
      timeZone,
      archivedAt: policy.archivedAt,
    },
    month,
    range,
    generatedAt: now,
    state: final ? ("final" as const) : ("provisional" as const),
    /** when the last member sealed; null while provisional */
    sealedAt: final
      ? new Date(Math.max(...sealRows.map((s) => s.sealedAt.getTime())))
      : null,
    provisional,
    /** no member has anything to judge in the month */
    empty: cells.every((c) => c.state === "none"),
    terms,
    monitors: rows,
    downtime: {
      items: stretches.slice(0, REPORT_DOWNTIME_MAX),
      more: Math.max(stretches.length - REPORT_DOWNTIME_MAX, 0),
    },
    excusedWindows,
    maintenances,
    missed,
    method: [
      MONITOR_SLA_METHOD,
      terms.strict
        ? "Slow runs count as down under this reporting."
        : "Slow runs count as up under this reporting.",
      "Time inside the reporting's excused windows is left out of both sides of the month.",
      "Uptime is floored to three decimals, so a missed month never rounds up to its target.",
      "A month is sealed with the terms it started with at least 72 hours after it ends, once its checks have loaded; a sealed month never changes.",
    ].join(" "),
  };
}

export type MonitorReportingReport = Awaited<
  ReturnType<typeof getMonitorReportingReport>
>;

/** Sealed months keep the windows they were sealed with; open months read the policy's. */
async function reportExcusedWindows(args: {
  ctx: ServiceContext;
  policyId: number;
  final: boolean;
  sealRows: (typeof monitorSlaSealedMonth.$inferSelect)[];
  range: { start: number; end: number };
}) {
  const { range } = args;
  type Window = {
    id: number;
    kind: MonitorSlaExcusedWindowKind;
    reason: string;
    from: number;
    to: number;
  };
  let windows: Window[];
  if (args.final) {
    const byId = new Map<number, Window>();
    for (const s of args.sealRows)
      for (const w of s.excusedWindows) byId.set(w.id, w);
    windows = [...byId.values()];
  } else {
    const rows = await getReadDb(args.ctx)
      .select()
      .from(monitorSlaExcusedWindow)
      .where(
        and(
          eq(monitorSlaExcusedWindow.monitorSlaPolicyId, args.policyId),
          eq(monitorSlaExcusedWindow.workspaceId, args.ctx.workspace.id),
          lt(monitorSlaExcusedWindow.from, new Date(range.end)),
          gt(monitorSlaExcusedWindow.to, new Date(range.start)),
        ),
      )
      .all();
    windows = rows.map((w) => ({
      id: w.id,
      kind: w.kind,
      reason: w.reason,
      from: w.from.getTime(),
      to: w.to.getTime(),
    }));
  }
  return windows
    .filter((w) => clippedMs(w.from, w.to, range) > 0)
    .sort((a, b) => a.from - b.from || a.id - b.id)
    .map((w) => ({
      id: w.id,
      kind: w.kind,
      reason: w.reason,
      from: new Date(w.from),
      to: new Date(w.to),
      /** the part inside the month */
      durationMs: clippedMs(w.from, w.to, range),
    }));
}

/** Status-page maintenances touching the month on the members, oldest first. */
async function reportMaintenances(args: {
  ctx: ServiceContext;
  members: {
    id: number;
    name: string;
    maintenanceMode: "pause" | "continue";
  }[];
  range: { start: number; end: number };
}) {
  const { ctx, members, range } = args;
  if (members.length === 0) return [];
  const rows = await getReadDb(ctx)
    .select({
      id: maintenance.id,
      title: maintenance.title,
      from: maintenance.from,
      to: maintenance.to,
      pageTitle: page.title,
      monitorId: pageComponent.monitorId,
    })
    .from(maintenancesToPageComponents)
    .innerJoin(
      maintenance,
      eq(maintenance.id, maintenancesToPageComponents.maintenanceId),
    )
    .innerJoin(
      pageComponent,
      eq(pageComponent.id, maintenancesToPageComponents.pageComponentId),
    )
    .leftJoin(page, eq(page.id, maintenance.pageId))
    .where(
      and(
        eq(maintenance.workspaceId, ctx.workspace.id),
        eq(pageComponent.workspaceId, ctx.workspace.id),
        inArray(
          pageComponent.monitorId,
          members.map((m) => m.id),
        ),
        lt(maintenance.from, new Date(range.end)),
        gt(maintenance.to, new Date(range.start)),
      ),
    )
    .orderBy(asc(maintenance.from), asc(maintenance.id))
    .all();
  const byId = new Map<
    number,
    {
      id: number;
      title: string;
      from: Date;
      to: Date;
      pageTitle: string | null;
      monitors: typeof members;
    }
  >();
  for (const { monitorId, ...row } of rows) {
    const member = members.find((m) => m.id === monitorId);
    if (!member) continue;
    const window = byId.get(row.id) ?? { ...row, monitors: [] };
    if (!window.monitors.some((m) => m.id === member.id)) {
      window.monitors.push({
        id: member.id,
        name: member.name,
        maintenanceMode: member.maintenanceMode,
      });
    }
    byId.set(row.id, window);
  }
  return [...byId.values()];
}

/** Months with any member's miss in the twelve months ending with `month`, sealed or preview. */
async function rollingMisses(args: {
  ctx: ServiceContext;
  policy: Parameters<typeof judgePolicyMonths>[0]["policy"];
  members: Parameters<typeof judgePolicyMonths>[0]["monitors"];
  month: string;
  now: Date;
  cells: Pick<MonitorSlaMonth, "month" | "met" | "state">[];
}) {
  // months before the report month are never read from episodes, so no Tinybird call
  const earlier = monthsBetween(
    shiftMonth(args.month, 1 - LAST_TWELVE),
    shiftMonth(args.month, -1),
  );
  const judged = await judgePolicyMonths({
    ctx: args.ctx,
    policy: args.policy,
    monitors: args.members,
    months: earlier,
    now: args.now,
    live: false,
  });
  const all = [...judged.monitors.flatMap((m) => m.months), ...args.cells];
  const missed = new Set<string>();
  const sealedMiss = new Set<string>();
  for (const c of all) {
    if (c.met !== false || c.state === "live") continue;
    missed.add(c.month);
    if (c.state === "sealed") sealedMiss.add(c.month);
  }
  return {
    months: missed.size,
    previews: missed.size - sealedMiss.size,
    of: LAST_TWELVE,
  };
}
