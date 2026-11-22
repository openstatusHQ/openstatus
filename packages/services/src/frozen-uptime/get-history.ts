import { and, eq, gte, inArray } from "@openstatus/db";
import {
  frozenMonitorUptime,
  frozenMonitorUptimeDaySchema,
  pageConfigurationSchema,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { defaultTb, getReadDb, type ServiceContext } from "../context";
import { ForbiddenError, NotFoundError } from "../errors";
import {
  dayCoverage,
  dayWindow,
  durationDowntimeMs,
  type Event,
  floorPct,
  getEvents,
  heartbeatCoverageStart,
  reportsOnlyDowntimeMs,
  requestsTally,
} from "../status-timeline";
import { monthRange } from "./compute";
import {
  type HistoryAnnotations,
  historyAnnotations,
} from "./history-annotations";
import {
  fetchLiveDays,
  liveRunsPipes,
  liveStatusPipes,
  type FrozenMonth,
  type LocalDays,
  mergeLocalDays,
} from "./live";
import { canonicalTimeZone, monthOf, monthsBetween } from "./months";
import type { Counts } from "./quorum";
import {
  FREEZE_CUTOFF_MS,
  type UptimeFreezePipes,
  countsRuns,
  type UptimeRunsPipes,
} from "./run";
import { GetUptimeHistoryInput } from "./schemas";

const HISTORY_MONTHS = 12;

type DayCount = { day: string; ok: number; degraded: number; error: number };

// native-unit numerators kept alongside the percentage so totals stay
// additive (checks for requests mode, milliseconds for event math);
// averaging monthly percentages would weigh a 2-day month like a full one
type MonthValue = {
  percentage: number;
  up: number;
  total: number;
  shown: Counts;
} | null;

/**
 * Whole requests or runs, or milliseconds for `time`, where `ok` is uptime,
 * `error` downtime and `degraded` always 0.
 */
type UptimeHistoryValue = Counts & { percentage: number };

type HistoryValues = {
  /** "YYYY-MM" → month; null = no data recorded, NEVER "down" */
  months: Record<string, UptimeHistoryValue | null>;
  /** counts are the sums of the month counts */
  total: UptimeHistoryValue | null;
};

function timeMonth(up: number, total: number): MonthValue {
  const shownUp = Math.round(up);
  return {
    percentage: floorPct(up / total),
    up,
    total,
    shown: { ok: shownUp, degraded: 0, error: Math.round(total) - shownUp },
  };
}

type UptimeHistoryEvent = Pick<
  Event,
  "id" | "name" | "type" | "status" | "from" | "to"
>;

type UptimeHistoryRow = HistoryValues & {
  component: {
    id: number;
    name: string;
    type: "monitor" | "static";
    /** for event links, null for static components */
    monitorId: number | null;
  };
  /** unit of `months` and `total` */
  unit: "requests" | "time";
  /** the same months counted per run, for monitors counted per request */
  runs: HistoryValues | null;
  /** component events in the window; clients bucket per month by overlap */
  events: UptimeHistoryEvent[];
} & HistoryAnnotations;

type UptimeHistoryResult = {
  mode: "requests" | "runs" | "duration" | "manual";
  /** what the public status page counts; differs from `mode` on an override */
  configuredMode: "requests" | "runs" | "duration" | "manual";
  /** the page's zone that months and days are grouped in */
  timeZone: string;
  /** oldest → newest, length HISTORY_MONTHS, last entry = current month */
  months: string[];
  /** months frozen without quarter-hour ranges, so still grouped in UTC days */
  utcOnlyMonths: string[];
  createdAt: Date | null;
  /** live counts failed for a monitor, so recent months may be missing */
  partial: boolean;
  /** live run verdicts failed, or the live counts they attach to */
  runsPartial: boolean;
  summary: {
    uptime: number | null;
    runsUptime: number | null;
    reports: number;
  };
  rows: UptimeHistoryRow[];
};

function monthKeys(now: Date, timeZone: string): string[] {
  const current = monthOf(now, timeZone);
  const [year, month] = current.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - HISTORY_MONTHS, 1));
  return monthsBetween(first.toISOString(), current).map((m) => m.slice(0, 7));
}

function requestsMonth(days: DayCount[] | null): MonthValue {
  if (!days) return null;
  const { up, total } = requestsTally(days);
  if (total === 0) return null;
  const shown = { ok: 0, degraded: 0, error: 0 };
  for (const d of days) {
    shown.ok += d.ok;
    shown.degraded += d.degraded;
    shown.error += d.error;
  }
  // regrouped days carry fractional totals; round only what is shown
  shown.ok = Math.round(shown.ok);
  shown.degraded = Math.round(shown.degraded);
  shown.error = Math.round(shown.error);
  return { percentage: floorPct(up / total), up, total, shown };
}

function durationMonth(
  days: DayCount[] | null,
  events: Event[],
  nowMs: number,
  timeZone: string,
): MonthValue {
  // denominator = days with checks, matching getUptime's data.length; frozen
  // months are zero-filled so counting all days would inflate sparse months
  const withChecks = (days ?? []).filter(
    (d) => d.ok + d.degraded + d.error > 0,
  );
  if (withChecks.length === 0) return null;
  // downtime is clipped to the checked days (a paused stretch can't exceed
  // the denominator) and the in-progress day is clamped to elapsed time so
  // 2h down on the 2nd isn't diluted by the rest of today
  const windows = withChecks.map((d) => dayWindow(d.day, timeZone));
  const { segments, totalMs } = dayCoverage(windows, nowMs);
  if (segments.length === 0 || totalMs <= 0) return null;
  const window = {
    start: segments[0].start,
    end: segments[segments.length - 1].end,
    now: nowMs,
  };
  const downtime = durationDowntimeMs(events, window, segments);
  return timeMonth(Math.max(0, totalMs - downtime), totalMs);
}

function eventOnlyMonth(
  events: Event[],
  key: string,
  nowMs: number,
  timeZone: string,
  notBeforeMs?: number,
): MonthValue {
  const { start, end } = monthRange(`${key}-01`, timeZone);
  // months fully before the component existed are "no data", not fake 100%
  if (notBeforeMs !== undefined && end <= notBeforeMs) return null;
  const clampedEnd = Math.min(end, nowMs);
  if (clampedEnd <= start) return null;
  const total = clampedEnd - start;
  const downtime = reportsOnlyDowntimeMs(events, {
    start,
    end: clampedEnd,
    now: nowMs,
  });
  return timeMonth(Math.max(0, total - downtime), total);
}

// heartbeat months span from the first signal, not just days with pings: a
// silent day is exactly when a heartbeat is down
function heartbeatMonth(
  events: Event[],
  key: string,
  nowMs: number,
  coverageStartMs: number | null,
  reportsOnly: boolean,
  timeZone: string,
): MonthValue {
  if (coverageStartMs === null) return null;
  const { start, end } = monthRange(`${key}-01`, timeZone);
  const from = Math.max(start, coverageStartMs);
  const to = Math.min(end, nowMs);
  if (to <= from) return null;
  const window = { start: from, end: to, now: nowMs };
  const downtime = reportsOnly
    ? reportsOnlyDowntimeMs(events, window)
    : durationDowntimeMs(events, window);
  const total = to - from;
  return timeMonth(Math.max(0, total - downtime), total);
}

function historyValues(
  months: string[],
  values: Map<string, MonthValue>,
): HistoryValues {
  let up = 0;
  let total = 0;
  const shown = { ok: 0, degraded: 0, error: 0 };
  for (const key of months) {
    const v = values.get(key);
    if (!v) continue;
    up += v.up;
    total += v.total;
    shown.ok += v.shown.ok;
    shown.degraded += v.shown.degraded;
    shown.error += v.shown.error;
  }
  return {
    months: Object.fromEntries(
      months.map((k) => {
        const v = values.get(k);
        return [k, v ? { percentage: v.percentage, ...v.shown } : null];
      }),
    ),
    total: total > 0 ? { percentage: floorPct(up / total), ...shown } : null,
  };
}

// components weigh equally — native units (checks vs ms) differ per
// component, so a cross-component sum would weight by unit volume
function averageUptime(values: (UptimeHistoryValue | null)[]): number | null {
  const uptimes = values.flatMap((v) => (v ? [v.percentage] : []));
  if (uptimes.length === 0) return null;
  return floorPct(uptimes.reduce((a, b) => a + b, 0) / uptimes.length / 100);
}

/**
 * Read-time uptime history for a page: frozen monthly counts + live Tinybird
 * for months the freeze hasn't covered, percentages recomputed under the
 * page's current calculation mode.
 */
export async function getUptimeHistory(args: {
  ctx: ServiceContext;
  input: GetUptimeHistoryInput;
  pipes?: UptimeFreezePipes;
  runsPipes?: UptimeRunsPipes;
  now?: Date;
  sleep?: (ms: number) => Promise<void>;
}): Promise<UptimeHistoryResult> {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetUptimeHistoryInput.parse(args.input);
  if (!ctx.workspace.limits["uptime-history"]) {
    throw new ForbiddenError("Uptime history is not enabled on this plan.");
  }
  const db = getReadDb(ctx);
  const now = args.now ?? new Date();
  const nowMs = now.getTime();

  const _page = await db.query.page.findFirst({
    where: (page, { and: andWhere, eq: eqWhere }) =>
      andWhere(
        eqWhere(page.id, input.pageId),
        eqWhere(page.workspaceId, ctx.workspace.id),
      ),
    with: {
      statusReports: {
        with: {
          statusReportUpdates: {
            orderBy: (updates, { desc }) => desc(updates.date),
            with: { statusReportUpdateToPageComponents: true },
          },
          statusReportsToPageComponents: { with: { pageComponent: true } },
        },
      },
      maintenances: {
        with: {
          maintenancesToPageComponents: { with: { pageComponent: true } },
        },
      },
      pageComponents: {
        with: { monitor: { with: { monitorIncidents: true } } },
        orderBy: (components, { asc }) => asc(components.order),
      },
    },
  });
  if (!_page) throw new NotFoundError("page", input.pageId);

  const configuration = pageConfigurationSchema.safeParse(
    _page.configuration ?? {},
  );
  const configuredMode = configuration.success
    ? configuration.data.value
    : "requests";
  const mode = input.mode ?? configuredMode;
  // both count checks; each row carries requests and runs, the client picks
  const countsRequests = mode === "requests" || mode === "runs";

  const timeZone = canonicalTimeZone(_page.defaultTimezone) ?? "UTC";
  const months = monthKeys(now, timeZone);

  const components = _page.pageComponents;
  const monitorIds = [
    ...new Set(
      components.flatMap((c) => (c.monitorId !== null ? [c.monitorId] : [])),
    ),
  ];

  // the frozen-rows read and the independent Tinybird round-trip overlap
  const dbReads = (async () => {
    if (monitorIds.length === 0) return { frozenRows: [] };
    const frozenRows = await db
      .select({
        monitorId: frozenMonitorUptime.monitorId,
        month: frozenMonitorUptime.month,
        days: frozenMonitorUptime.days,
      })
      .from(frozenMonitorUptime)
      .where(
        and(
          eq(frozenMonitorUptime.workspaceId, ctx.workspace.id),
          inArray(frozenMonitorUptime.monitorId, monitorIds),
          gte(frozenMonitorUptime.month, `${months[0]}-01`),
        ),
      );
    return { frozenRows };
  })();

  // current month is never frozen, the previous may not be yet (the freeze
  // runs early next month) — both come live from the 45d pipes; failed
  // monitors land in failedMonitorIds and render as no-data
  const tb = ctx.tb ?? defaultTb;
  const liveReads = fetchLiveDays({
    monitors: components.flatMap((c) => (c.monitor ? [c.monitor] : [])),
    pipes: args.pipes ?? liveStatusPipes(tb, timeZone),
    runsPipes: countsRequests
      ? (args.runsPipes ?? liveRunsPipes(tb, timeZone))
      : undefined,
    sleep: args.sleep,
  });

  const [
    { frozenRows },
    {
      days: liveDays,
      failedMonitorIds: liveFailed,
      failedRunsMonitorIds: liveRunsFailed,
    },
  ] = await Promise.all([dbReads, liveReads]);
  const frozenByMonitor = new Map<number, FrozenMonth[]>();
  for (const r of frozenRows) {
    const list = frozenByMonitor.get(r.monitorId) ?? [];
    list.push({
      month: r.month,
      days: frozenMonitorUptimeDaySchema.array().parse(r.days),
    });
    frozenByMonitor.set(r.monitorId, list);
  }

  const heartbeatIds = new Set(
    components.flatMap((c) =>
      c.monitor?.jobType === "heartbeat" ? [c.monitor.id] : [],
    ),
  );
  const localByMonitor = new Map<number, LocalDays>();
  function localDaysOf(monitorId: number) {
    let local = localByMonitor.get(monitorId);
    if (!local) {
      local = mergeLocalDays({
        frozen: frozenByMonitor.get(monitorId) ?? [],
        live: liveFailed.has(String(monitorId))
          ? []
          : (liveDays.get(String(monitorId))?.values() ?? []),
        timeZone,
        quarterHours: !heartbeatIds.has(monitorId),
      });
      localByMonitor.set(monitorId, local);
    }
    return local;
  }

  // a day without `runs` is left out of the runs view, never derived
  function countsFor(
    monitorId: number,
    key: string,
    metric: "requests" | "runs" = "requests",
  ): DayCount[] | null {
    const frozen = frozenByMonitor
      .get(monitorId)
      ?.some((r) => r.month.startsWith(key));
    // Unfrozen months need full retention coverage, just like the freeze job.
    const isLive =
      nowMs - monthRange(`${key}-01`, timeZone).start < FREEZE_CUTOFF_MS;
    if (!frozen && (!isLive || liveFailed.has(String(monitorId)))) return null;
    const days = localDaysOf(monitorId)[metric].filter((d) =>
      d.day.startsWith(key),
    );
    return days.length > 0 ? days : null;
  }

  const pastDays = HISTORY_MONTHS * 31 + 7;
  const rows: Omit<UptimeHistoryRow, keyof HistoryAnnotations>[] =
    components.map((c) => {
      const events = getEvents({
        maintenances: _page.maintenances,
        incidents: c.monitor?.monitorIncidents ?? [],
        reports: _page.statusReports,
        pageComponentId: c.id,
        monitorId: c.monitorId ?? undefined,
        componentType: c.type,
        pastDays,
      });

      const heartbeatId =
        c.type === "monitor" && c.monitor?.jobType === "heartbeat"
          ? c.monitorId
          : null;
      const heartbeatStart =
        heartbeatId !== null
          ? heartbeatCoverageStart(
              months.flatMap((key) => countsFor(heartbeatId, key) ?? []),
              events,
              timeZone,
            )
          : null;

      const values = new Map<string, MonthValue>();
      for (const key of months) {
        let value: MonthValue = null;
        if (heartbeatId !== null) {
          value = heartbeatMonth(
            events,
            key,
            nowMs,
            heartbeatStart,
            mode === "manual",
            timeZone,
          );
        } else if (c.type === "monitor" && c.monitorId !== null) {
          const days = countsFor(c.monitorId, key);
          if (countsRequests) {
            value = requestsMonth(days);
          } else if (mode === "duration") {
            value = durationMonth(days, events, nowMs, timeZone);
          } else {
            // manual mode still keys "did the monitor run" off counts: a
            // zero-check month has no meaningful uptime in any mode
            value = days?.some((d) => d.ok + d.degraded + d.error > 0)
              ? eventOnlyMonth(events, key, nowMs, timeZone)
              : null;
          }
        } else {
          value = eventOnlyMonth(
            events,
            key,
            nowMs,
            timeZone,
            c.createdAt?.getTime() ?? undefined,
          );
        }
        values.set(key, value);
      }

      const requestsId =
        heartbeatId === null && c.type === "monitor" && countsRequests
          ? c.monitorId
          : null;
      // private-only monitors have no runs; like the public page they keep requests
      const runsId =
        requestsId !== null && c.monitor && countsRuns(c.monitor)
          ? requestsId
          : null;
      const runValues = new Map<string, MonthValue>();
      if (runsId !== null) {
        for (const key of months) {
          runValues.set(key, requestsMonth(countsFor(runsId, key, "runs")));
        }
      }

      return {
        component: {
          id: c.id,
          name: c.name,
          type:
            c.type === "static" ? ("static" as const) : ("monitor" as const),
          monitorId: c.monitorId,
        },
        unit: requestsId !== null ? ("requests" as const) : ("time" as const),
        ...historyValues(months, values),
        runs: runsId !== null ? historyValues(months, runValues) : null,
        events: events.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          status: e.status,
          from: e.from,
          to: e.to,
        })),
      };
    });

  // page-level events (no component filter) for the report metric
  const pageEvents = getEvents({
    maintenances: _page.maintenances,
    incidents: [],
    reports: _page.statusReports,
    pastDays,
  });

  const annotations = await historyAnnotations({
    db,
    workspaceId: ctx.workspace.id,
    components,
    sinceMs: nowMs - pastDays * 86_400_000,
  });
  const annotatedRows = rows.map((row, i) => ({ ...row, ...annotations[i] }));

  const historyStart = monthRange(`${months[0]}-01`, timeZone).start;
  const reports = new Set<number>();
  for (const e of pageEvents) {
    if (e.type !== "report") continue;
    const endMs = e.to?.getTime() ?? nowMs;
    if (e.from.getTime() <= nowMs && endMs >= historyStart) reports.add(e.id);
  }
  const summary: UptimeHistoryResult["summary"] = {
    uptime: averageUptime(rows.map((r) => r.total)),
    runsUptime: averageUptime(rows.map((r) => (r.runs ?? r).total)),
    reports: reports.size,
  };

  // heartbeat months are measured in time, never from the frozen days
  const utcOnlyMonths = new Set<string>();
  for (const c of components) {
    if (c.monitorId === null || c.monitor?.jobType === "heartbeat") continue;
    for (const m of localDaysOf(c.monitorId).utcOnlyMonths) {
      utcOnlyMonths.add(m);
    }
  }

  return {
    mode,
    configuredMode,
    timeZone,
    months,
    utcOnlyMonths: months.filter((m) => utcOnlyMonths.has(m)),
    createdAt: _page.createdAt,
    partial: liveFailed.size > 0,
    runsPartial:
      liveRunsFailed.size > 0 ||
      components.some(
        (c) =>
          c.monitor &&
          countsRuns(c.monitor) &&
          liveFailed.has(String(c.monitor.id)),
      ),
    summary,
    rows: annotatedRows,
  };
}
