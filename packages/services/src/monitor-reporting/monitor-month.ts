import { and, asc, eq, gt, isNull, lt } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedEpisode,
  monitorSlaSealedMonth,
  pageComponent,
} from "@openstatus/db/src/schema";
import type { MonitorSlaCreditSchedule } from "@openstatus/db/src/schema/monitor_sla_policies/constants";

import { requireScope } from "../auth";
import { type DB, defaultTb, getReadDb, type ServiceContext } from "../context";
import { NotFoundError, ValidationError } from "../errors";
import { monthRange } from "../frozen-uptime/compute";
import { cutExcused, type Episode, slaBudget } from "./episodes";
import { mergeSpans, type Span } from "./excused";
import {
  clipEpisodes,
  fetchSlaEpisodes,
  type SlaEpisodesPipes,
  slaEpisodesPipes,
} from "./fetch-episodes";
import {
  assertMonitorSlaLimit,
  episodeMonths,
  type FetchedEpisodes,
  fetchMonthEpisodes,
  loadPolicyMembers,
  loadTermsHistory,
  memberEpisodes,
  memberTimeMonth,
  type PolicyMember,
  policyExcusedSpans,
  termsForMonth,
  termsStateOf,
} from "./internal";
import {
  coveredSpan,
  type MonitorSlaMonth,
  monthOf,
  storedMonth,
} from "./months";
import {
  GetMonitorReportingMonthInput,
  ListMonitorReportingMonthsInput,
} from "./schemas";

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
  maintenance: { id: number; title: string } | null;
};

type MonthMaintenance = { id: number; title: string; from: Date; to: Date };

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
      ? { ...e, maintenance: { id: best.window.id, title: best.window.title } }
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

type MonitorMaintenances = {
  mode: "pause" | "continue";
  windows: MonthMaintenance[];
};

/** The monitor's maintenances touching `range`, upcoming ones included. */
async function loadMonitorMaintenances(
  db: DB,
  workspaceId: number,
  monitorId: number,
  range: Span,
): Promise<MonitorMaintenances> {
  const [row, windows] = await Promise.all([
    db
      .select({ maintenanceMode: monitor.maintenanceMode })
      .from(monitor)
      .where(
        and(eq(monitor.id, monitorId), eq(monitor.workspaceId, workspaceId)),
      )
      .get(),
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
      .orderBy(asc(maintenance.from), asc(maintenance.id))
      .all(),
  ]);
  return { mode: row?.maintenanceMode ?? "pause", windows };
}

type MonthPolicy = {
  id: number;
  workspaceId: number;
  name: string;
  timeZone: string;
  archivedAt: Date | null;
};

/**
 * One member's month in the policy zone, from a seal or from episodes. Reads
 * episodes itself unless `fetched` already covers the month.
 */
async function memberMonth(args: {
  ctx: ServiceContext;
  db: DB;
  policy: MonthPolicy;
  member: PolicyMember;
  month: string;
  now: Date;
  maintenances: MonitorMaintenances;
  fetched?: FetchedEpisodes;
  episodesPipes?: SlaEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx, db, policy, member, month, now, maintenances } = args;
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
  let creditSchedule: MonitorSlaCreditSchedule | null;

  if (seal) {
    cell = storedMonth({ month, seal, timeZone });
    creditSchedule = seal.creditSchedule;
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
    spans = policySpans;
    const state = episodeMonths(now, timeZone).get(month);
    if (state) {
      const [terms, fetched] = await Promise.all([
        termsForMonth(db, policy, month),
        args.fetched ??
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
      creditSchedule = terms.creditSchedule;
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
        const notAhead =
          maintenances.mode === "pause"
            ? mergeSpans([
                ...spans.map((x) => ({
                  from: new Date(x.start),
                  to: new Date(x.end),
                })),
                ...maintenances.windows,
              ])
            : spans;
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
      creditSchedule = (await termsForMonth(db, policy, month)).creditSchedule;
      episodesUnavailable = "expired";
    }
  }

  const pausing = maintenances.mode === "pause";
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
    /** the schedule of the terms for this month, also when the month has no judgement */
    creditSchedule,
    range,
    maintenanceMode: maintenances.mode,
    budget,
    episodes: episodes
      ? labelMaintenances(
          episodes.sort((a, b) => b.startedAt - a.startedAt),
          pausing ? maintenances.windows : [],
        )
      : null,
    episodesUnavailable,
    /** continue-mode maintenances in the month so far with time no excused window covers: checks ran and count */
    countedMaintenances: pausing
      ? []
      : maintenances.windows.filter((w) => {
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

/**
 * The running month of a monitor under each active reporting covering it,
 * from one episodes read and one maintenance read.
 */
export async function listMonitorReportingMonths(args: {
  ctx: ServiceContext;
  input: ListMonitorReportingMonthsInput;
  now?: Date;
  episodesPipes?: SlaEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = ListMonitorReportingMonthsInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const db = getReadDb(ctx);
  const now = args.now ?? new Date();

  const rows = await db
    .select({
      policy: monitorSlaPolicy,
      member: {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        jobType: monitor.jobType,
        regions: monitor.regions,
        periodicity: monitor.periodicity,
        memberSince: monitorSlaPolicyToMonitor.createdAt,
      },
    })
    .from(monitorSlaPolicyToMonitor)
    .innerJoin(
      monitorSlaPolicy,
      eq(monitorSlaPolicy.id, monitorSlaPolicyToMonitor.monitorSlaPolicyId),
    )
    .innerJoin(monitor, eq(monitor.id, monitorSlaPolicyToMonitor.monitorId))
    .where(
      and(
        eq(monitorSlaPolicyToMonitor.monitorId, input.monitorId),
        eq(monitorSlaPolicy.workspaceId, ctx.workspace.id),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitorSlaPolicy.archivedAt),
        isNull(monitor.deletedAt),
      ),
    )
    .orderBy(asc(monitorSlaPolicy.id))
    .all();
  if (rows.length === 0) return [];

  const ranges = rows.map(({ policy }) =>
    monthRange(monthOf(now, policy.timeZone), policy.timeZone),
  );
  const span = {
    start: Math.min(...ranges.map((r) => r.start)),
    end: Math.max(...ranges.map((r) => r.end)),
  };
  const member = rows[0].member;
  const fetchRange = { start: span.start, end: now.getTime() };
  const [history, maintenances, read] = await Promise.all([
    loadTermsHistory(
      db,
      ctx.workspace.id,
      rows.map((r) => r.policy),
    ),
    loadMonitorMaintenances(db, ctx.workspace.id, member.id, span),
    fetchSlaEpisodes({
      monitors: [member],
      fromMs: fetchRange.start,
      toMs: fetchRange.end,
      pipes: () => args.episodesPipes ?? slaEpisodesPipes(ctx.tb ?? defaultTb),
      throttleMs: 0,
      sleep: args.sleep,
    }),
  ]);
  const fetched: FetchedEpisodes = { ...read, range: fetchRange };

  return Promise.all(
    rows.map(async ({ policy, member }) => ({
      id: policy.id,
      name: policy.name,
      timeZone: policy.timeZone,
      ...termsStateOf(history, policy, now),
      month: await memberMonth({
        ctx,
        db,
        policy,
        member,
        month: monthOf(now, policy.timeZone),
        now,
        maintenances,
        fetched,
      }),
    })),
  );
}

export type MonitorReportingMonth = Awaited<
  ReturnType<typeof getMonitorReportingMonth>
>;
