import { and, asc, eq, gt, lt, lte } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorSlaSealedEpisode,
  monitorSlaSealedMonth,
  pageComponent,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type DB, getReadDb, type ServiceContext } from "../context";
import { NotFoundError, ValidationError } from "../errors";
import { monthRange } from "../frozen-uptime/compute";
import type { UptimeRunsRangePipes } from "../frozen-uptime/run";
import { cutExcused, type Episode, slaBudget } from "./episodes";
import { mergeSpans, type Span } from "./excused";
import { clipEpisodes, type SlaEpisodesPipes } from "./fetch-episodes";
import {
  assertMonitorSlaLimit,
  episodeMonths,
  fetchMonthEpisodes,
  judgePolicyMonths,
  loadPolicyMembers,
  memberEpisodes,
  memberTimeMonth,
  policyExcusedSpans,
  termsForMonth,
} from "./internal";
import {
  coveredSpan,
  type MonitorSlaMonth,
  monthOf,
  storedMonth,
} from "./months";
import { GetMonitorSlaMonitorMonthInput } from "./schemas";

/** counted: down time; lenient: degraded under a non-strict policy; excused: cut by an excused window. */
export type MonitorSlaMonthEpisodeTreatment =
  | "counted"
  | "lenient"
  | "excused"
  | "unmeasured";

export type MonitorSlaMonthEpisode = {
  kind: "degraded" | "error" | "unmeasured";
  startedAt: number;
  endedAt: number;
  runs: number;
  weightedMs: number;
  treatment: MonitorSlaMonthEpisodeTreatment;
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
): MonitorSlaMonthEpisode[] {
  const { kept, excused } = cutExcused(episodes, spans);
  const out: MonitorSlaMonthEpisode[] = [];
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
  episodes: MonitorSlaMonthEpisode[],
  windows: readonly MonthMaintenance[],
): MonitorSlaMonthEpisode[] {
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

async function loadMonitorMaintenances(
  db: DB,
  workspaceId: number,
  monitorId: number,
  range: Span,
  now: Date,
) {
  const row = await db
    .select({ maintenanceMode: monitor.maintenanceMode })
    .from(monitor)
    .where(and(eq(monitor.id, monitorId), eq(monitor.workspaceId, workspaceId)))
    .get();
  const rows = await db
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
        lte(maintenance.from, now),
        lt(maintenance.from, new Date(range.end)),
        gt(maintenance.to, new Date(range.start)),
      ),
    )
    .orderBy(asc(maintenance.from), asc(maintenance.id))
    .all();
  return { mode: row?.maintenanceMode ?? "pause", windows: rows };
}

/**
 * One member's month in the policy zone: its month cell, down-time budget,
 * non-ok episodes newest first with their treatment, and unexcused continue-mode maintenances.
 */
export async function getMonitorSlaMonitorMonth(args: {
  ctx: ServiceContext;
  input: GetMonitorSlaMonitorMonthInput;
  now?: Date;
  episodesPipes?: SlaEpisodesPipes;
  runsRangePipes?: UptimeRunsRangePipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMonitorSlaMonitorMonthInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const db = getReadDb(ctx);
  const { policy, monitors } = await loadPolicyMembers(ctx, input.id);
  const member = monitors.find((m) => m.id === input.monitorId);
  if (!member) throw new NotFoundError("monitor", input.monitorId);

  const now = args.now ?? new Date();
  const { timeZone } = policy;
  const current = monthOf(now, timeZone);
  const month = input.month ? `${input.month}-01` : current;
  if (month > current) {
    throw new ValidationError("This month has not started yet.");
  }
  const range = monthRange(month, timeZone);
  const maintenances = await loadMonitorMaintenances(
    db,
    ctx.workspace.id,
    member.id,
    range,
    now,
  );

  const seal = await db
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
    .get();

  let cell: MonitorSlaMonth;
  let spans: Span[];
  let budget: ReturnType<typeof monthBudget> | null = null;
  let episodes: MonitorSlaMonthEpisode[] | null = null;
  /** runs: judged by run count; failed: episodes could not be read; expired: runs no longer kept; time-zone: old month in a non-UTC zone */
  let episodesUnavailable: "runs" | "failed" | "expired" | "time-zone" | null =
    null;

  if (seal) {
    cell = storedMonth({ month, seal, frozen: undefined, policy });
    spans = mergeSpans(
      seal.excusedWindows.map((w) => ({
        from: new Date(w.from),
        to: new Date(w.to),
      })),
    );
    if (seal.method === "runs") {
      episodesUnavailable = "runs";
    } else {
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
    }
  } else {
    spans = await policyExcusedSpans(db, policy);
    const state = episodeMonths(now, timeZone).get(month);
    if (state) {
      const terms = await termsForMonth(db, policy, month);
      const fetched = await fetchMonthEpisodes({
        ctx,
        members: [member],
        months: [month],
        timeZone,
        now,
        pipes: args.episodesPipes,
        sleep: args.sleep,
      });
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
      const judged = await judgePolicyMonths({
        ctx,
        policy,
        monitors: [member],
        months: [month],
        now,
        live: false,
        runsRangePipes: args.runsRangePipes,
        sleep: args.sleep,
      });
      cell = judged.monitors[0].months[0];
      episodesUnavailable =
        cell.unavailable === "time-zone" ? "time-zone" : "expired";
    }
  }

  const pausing = maintenances.mode === "pause";
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
    maintenanceMode: maintenances.mode,
    budget,
    episodes: episodes
      ? labelMaintenances(
          episodes.sort((a, b) => b.startedAt - a.startedAt),
          pausing ? maintenances.windows : [],
        )
      : null,
    episodesUnavailable,
    /** continue-mode maintenances in the month with time no excused window covers: checks ran and count */
    countedMaintenances: pausing
      ? []
      : maintenances.windows.filter((w) => {
          const part = {
            start: Math.max(w.from.getTime(), range.start),
            end: Math.min(w.to.getTime(), range.end),
          };
          return part.end - part.start > overlapMs(part, spans);
        }),
  };
}

export type MonitorSlaMonitorMonth = Awaited<
  ReturnType<typeof getMonitorSlaMonitorMonth>
>;
