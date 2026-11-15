import { and, eq, gt, lt } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
  monitorSlaSealedEpisode,
  monitorSlaSealedMonth,
  pageComponent,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type DB, getReadDb, type ServiceContext } from "../context";
import { NotFoundError, ValidationError } from "../errors";
import { monthRange } from "../frozen-uptime/compute";
import { cutExcused, type Episode, slaBudget } from "./episodes";
import { mergeSpans, type Span } from "./excused";
import { clipEpisodes, type SlaEpisodesPipes } from "./fetch-episodes";
import {
  assertMonitorSlaLimit,
  episodeMonths,
  fetchMonthEpisodes,
  loadPolicyMembers,
  memberEpisodes,
  memberTimeMonth,
  type PolicyMember,
  policyExcusedSpans,
  termsForMonth,
} from "./internal";
import {
  coveredSpan,
  type MonitorSlaMonth,
  monthOf,
  storedMonth,
} from "./months";
import { GetMonitorReportingMonthInput } from "./schemas";

/** counted: down time; lenient: degraded under a non-strict policy; excused: cut by an excused window. */
export type MonitorReportingMonthEpisodeTreatment =
  | "counted"
  | "lenient"
  | "excused"
  | "unmeasured";

export type MonitorReportingMonthEpisode = {
  kind: "degraded" | "error" | "unmeasured";
  startedAt: number;
  endedAt: number;
  runs: number;
  weightedMs: number;
  treatment: MonitorReportingMonthEpisodeTreatment;
  /** a pause-mode maintenance that overlaps an unmeasured episode */
  maintenance: Pick<MonthMaintenance, "kind" | "id" | "title"> | null;
};

/** page: a status-page maintenance, which pauses checks. window: a maintenance window. */
type MonthMaintenance = {
  kind: "page" | "window";
  id: number;
  title: string;
  mode: "pause" | "continue";
  from: Date;
  to: Date;
};

function overlapMs(a: Span, spans: readonly Span[]): number {
  let sum = 0;
  for (const s of spans) {
    sum += Math.max(0, Math.min(a.end, s.end) - Math.max(a.start, s.start));
  }
  return sum;
}

function treatEpisodes(
  episodes: readonly Episode[],
  spans: readonly Span[],
  strict: boolean,
): MonitorReportingMonthEpisode[] {
  const { kept, excused } = cutExcused(episodes, spans);
  const out: MonitorReportingMonthEpisode[] = [];
  for (const e of kept) {
    if (e.kind === "ok") continue;
    out.push({
      ...e,
      kind: e.kind,
      treatment:
        e.kind === "unmeasured"
          ? "unmeasured"
          : e.kind === "error" || strict
            ? "counted"
            : "lenient",
      maintenance: null,
    });
  }
  for (const e of excused) {
    if (e.kind === "ok") continue;
    out.push({ ...e, kind: e.kind, treatment: "excused", maintenance: null });
  }
  return out;
}

function labelMaintenances(
  episodes: MonitorReportingMonthEpisode[],
  windows: readonly MonthMaintenance[],
): MonitorReportingMonthEpisode[] {
  return episodes.map((e) => {
    if (e.treatment !== "unmeasured") return e;
    let best: { window: MonthMaintenance; ms: number } | null = null;
    for (const w of windows) {
      const ms = overlapMs({ start: e.startedAt, end: e.endedAt }, [
        { start: w.from.getTime(), end: w.to.getTime() },
      ]);
      if (ms > 0 && (!best || ms > best.ms)) best = { window: w, ms };
    }
    return best
      ? {
          ...e,
          maintenance: {
            kind: best.window.kind,
            id: best.window.id,
            title: best.window.title,
          },
        }
      : e;
  });
}

/** Budget, burn and pace over measured time plus covered, non-excused time still to come. */
function monthBudget(args: {
  monthMs: number;
  excusedMs: number;
  remainingMs: number;
  target: number;
  downMs: number | null;
  measuredMs: number | null;
}) {
  const measuredMs = args.measuredMs ?? 0;
  const budget = slaBudget({
    measuredMs,
    remainingMs: args.remainingMs,
    target: args.target,
    downMs: args.downMs ?? 0,
  });
  return {
    ...budget,
    paceMs: measuredMs > 0 ? budget.paceMs : null,
    monthMs: args.monthMs,
    excusedMs: args.excusedMs,
    measuredMs,
    remainingMs: args.remainingMs,
  };
}

/** The monitor's maintenances touching `range`, upcoming ones included. */
async function loadMonitorMaintenances(
  db: DB,
  workspaceId: number,
  monitorId: number,
  range: Span,
): Promise<MonthMaintenance[]> {
  const [pages, windows] = await Promise.all([
    db
      .selectDistinct({
        id: maintenance.id,
        title: maintenance.title,
        from: maintenance.from,
        to: maintenance.to,
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
      .where(
        and(
          eq(maintenance.workspaceId, workspaceId),
          eq(pageComponent.workspaceId, workspaceId),
          eq(pageComponent.monitorId, monitorId),
          lt(maintenance.from, new Date(range.end)),
          gt(maintenance.to, new Date(range.start)),
        ),
      )
      .all(),
    db
      .select({
        id: monitorMaintenanceWindow.id,
        title: monitorMaintenanceWindow.title,
        mode: monitorMaintenanceWindow.mode,
        from: monitorMaintenanceWindow.from,
        to: monitorMaintenanceWindow.to,
      })
      .from(monitorMaintenanceWindowToMonitor)
      .innerJoin(
        monitorMaintenanceWindow,
        eq(
          monitorMaintenanceWindow.id,
          monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
        ),
      )
      .where(
        and(
          eq(monitorMaintenanceWindow.workspaceId, workspaceId),
          eq(monitorMaintenanceWindowToMonitor.monitorId, monitorId),
          lt(monitorMaintenanceWindow.from, new Date(range.end)),
          gt(monitorMaintenanceWindow.to, new Date(range.start)),
        ),
      )
      .all(),
  ]);
  return [
    ...pages.map((m) => ({
      ...m,
      kind: "page" as const,
      mode: "pause" as const,
    })),
    ...windows.map((w) => ({ ...w, kind: "window" as const })),
  ].sort((a, b) => a.from.getTime() - b.from.getTime() || a.id - b.id);
}

type MonthPolicy = {
  id: number;
  workspaceId: number;
  name: string;
  timeZone: string;
  archivedAt: Date | null;
};

/**
 * One member's month in the policy zone, from a seal or from episodes.
 */
async function memberMonth(args: {
  ctx: ServiceContext;
  db: DB;
  policy: MonthPolicy;
  member: PolicyMember;
  month: string;
  now: Date;
  maintenances: MonthMaintenance[];
  episodesPipes?: SlaEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx, db, policy, member, month, now, maintenances } = args;
  const pausing = maintenances.filter((m) => m.mode === "pause");
  const { timeZone } = policy;
  const range = monthRange(month, timeZone);

  const [seal, policySpans] = await Promise.all([
    db
      .select()
      .from(monitorSlaSealedMonth)
      .where(
        and(
          eq(monitorSlaSealedMonth.monitorSlaPolicyId, policy.id),
          eq(monitorSlaSealedMonth.workspaceId, ctx.workspace.id),
          eq(monitorSlaSealedMonth.monitorId, member.id),
          eq(monitorSlaSealedMonth.month, month),
        ),
      )
      .get(),
    policyExcusedSpans(db, policy),
  ]);

  let cell: MonitorSlaMonth;
  let spans: Span[];
  let budget: ReturnType<typeof monthBudget> | null = null;
  let episodes: MonitorReportingMonthEpisode[] | null = null;
  /** failed: episodes could not be read; expired: older than the previous month and never sealed */
  let episodesUnavailable: "failed" | "expired" | null = null;

  if (seal) {
    cell = storedMonth({ month, seal, timeZone });
    spans = mergeSpans(
      seal.excusedWindows.map((w) => ({
        from: new Date(w.from),
        to: new Date(w.to),
      })),
    );
    const rows = await db
      .select()
      .from(monitorSlaSealedEpisode)
      .where(
        and(
          eq(monitorSlaSealedEpisode.sealedMonthId, seal.id),
          eq(monitorSlaSealedEpisode.workspaceId, ctx.workspace.id),
        ),
      )
      .all();
    episodes = rows.flatMap(({ kind, treatment, ...e }) =>
      kind === "ok"
        ? []
        : [
            {
              kind,
              startedAt: e.startedAt,
              endedAt: e.endedAt,
              runs: e.runs,
              weightedMs: e.weightedMs,
              treatment:
                kind === "unmeasured" && treatment !== "excused"
                  ? "unmeasured"
                  : treatment,
              maintenance: null,
            },
          ],
    );
    const excusedMs = seal.excusedMs ?? 0;
    budget = monthBudget({
      // the sealed episodes tile the covered month
      monthMs: (seal.measuredMs ?? 0) + (seal.unmeasuredMs ?? 0) + excusedMs,
      excusedMs,
      remainingMs: 0,
      target: seal.target,
      downMs: seal.downMs,
      measuredMs: seal.measuredMs,
    });
  } else {
    spans = policySpans.get(member.id) ?? [];
    const state = episodeMonths(now, timeZone).get(month);
    if (state) {
      const [terms, fetched] = await Promise.all([
        termsForMonth(db, policy, month),
        fetchMonthEpisodes({
          ctx,
          members: [member],
          months: [month],
          timeZone,
          now,
          pipes: args.episodesPipes,
          sleep: args.sleep,
        }),
      ]);
      cell = memberTimeMonth({
        month,
        state,
        member,
        fetched,
        excusedSpans: spans,
        terms,
        timeZone,
        now,
      });
      const covered = coveredSpan(month, timeZone, member.memberSince, now);
      const whole = coveredSpan(month, timeZone, member.memberSince, range.end);
      if (fetched.failed.has(member.id)) {
        episodesUnavailable = "failed";
      } else if (!covered || !whole) {
        episodes = [];
      } else {
        episodes = treatEpisodes(
          clipEpisodes(
            memberEpisodes(member.id, fetched),
            covered.start,
            covered.end,
          ),
          spans,
          terms.strict,
        );
        const ahead = {
          start: Math.max(now.getTime(), whole.start),
          end: whole.end,
        };
        // checks pause under a pause-mode maintenance, so its time ahead goes unmeasured
        const notAhead = mergeSpans([
          ...spans.map((x) => ({
            from: new Date(x.start),
            to: new Date(x.end),
          })),
          ...pausing,
        ]);
        budget = monthBudget({
          monthMs: whole.end - whole.start,
          excusedMs: overlapMs(whole, spans),
          remainingMs:
            ahead.end > ahead.start
              ? ahead.end - ahead.start - overlapMs(ahead, notAhead)
              : 0,
          target: terms.target,
          downMs: cell.downMs,
          measuredMs: cell.measuredMs,
        });
      }
    } else {
      cell = storedMonth({ month, seal: undefined, timeZone });
      episodesUnavailable = "expired";
    }
  }

  const nowMs = now.getTime();
  return {
    ...cell,
    policy: {
      id: policy.id,
      name: policy.name,
      timeZone: policy.timeZone,
      archivedAt: policy.archivedAt,
    },
    monitor: { id: member.id, name: member.name },
    range,
    budget,
    episodes: episodes
      ? labelMaintenances(
          episodes.sort((a, b) => b.startedAt - a.startedAt),
          pausing,
        )
      : null,
    episodesUnavailable,
    /** continue-mode maintenances in the month so far with time no excused window covers: checks ran and count */
    countedMaintenances: maintenances.filter((w) => {
      if (w.mode !== "continue") return false;
      const part = {
        start: Math.max(w.from.getTime(), range.start),
        end: Math.min(w.to.getTime(), range.end, nowMs),
      };
      return part.end - part.start > overlapMs(part, spans);
    }),
  };
}

/**
 * One member's month in the policy zone: its month cell, down-time budget,
 * non-ok episodes newest first with their treatment, and unexcused continue-mode maintenances.
 */
export async function getMonitorReportingMonth(args: {
  ctx: ServiceContext;
  input: GetMonitorReportingMonthInput;
  now?: Date;
  episodesPipes?: SlaEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMonitorReportingMonthInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const db = getReadDb(ctx);
  const { policy, monitors } = await loadPolicyMembers(ctx, input.id);
  const member = monitors.find((m) => m.id === input.monitorId);
  if (!member) throw new NotFoundError("monitor", input.monitorId);

  const now = args.now ?? new Date();
  const current = monthOf(now, policy.timeZone);
  const month = input.month ? `${input.month}-01` : current;
  if (month > current) {
    throw new ValidationError("This month has not started yet.");
  }
  const maintenances = await loadMonitorMaintenances(
    db,
    ctx.workspace.id,
    member.id,
    monthRange(month, policy.timeZone),
  );
  return memberMonth({
    ctx,
    db,
    policy,
    member,
    month,
    now,
    maintenances,
    episodesPipes: args.episodesPipes,
    sleep: args.sleep,
  });
}

export type MonitorReportingMonth = Awaited<
  ReturnType<typeof getMonitorReportingMonth>
>;
