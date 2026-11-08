import { and, eq, gte, inArray } from "@openstatus/db";
import {
  frozenMonitorUptime,
  type FrozenMonitorUptimeDay,
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
import { fetchLiveDays } from "./live";
import type { Counts } from "./quorum";
import {
  FREEZE_CUTOFF_MS,
  type UptimeFreezePipes,
  uptimeFreezePipes,
} from "./run";
import { GetUptimeHistoryInput } from "./schemas";

const HISTORY_MONTHS = 24;

const WINDOWS = [6, 12, 24] as const;
type HistoryWindowKey = "6" | "12" | "24";

// safe because HistoryWindowKey is exactly the string form of each WINDOWS entry
function windowKey(w: (typeof WINDOWS)[number]): HistoryWindowKey {
  return String(w) as HistoryWindowKey;
}

type DayCount = { day: string; ok: number; degraded: number; error: number };

// native-unit numerators kept alongside the percentage so rolling windows
// stay additive (checks for requests mode, milliseconds for event math);
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
  /** counts are the sums of the window's month counts */
  rolling: Record<HistoryWindowKey, UptimeHistoryValue | null>;
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
  /** unit of `months` and `rolling` */
  unit: "requests" | "time";
  /** the same months counted per run, for monitors counted per request */
  runs: HistoryValues | null;
  /** component events in the window; clients bucket per month by overlap */
  events: UptimeHistoryEvent[];
};

type UptimeHistoryResult = {
  mode: "requests" | "duration" | "manual";
  /** oldest → newest, length HISTORY_MONTHS, last entry = current month */
  months: string[];
  createdAt: Date | null;
  summary: Record<
    HistoryWindowKey,
    { uptime: number | null; runsUptime: number | null; reports: number }
  >;
  rows: UptimeHistoryRow[];
};

function monthKeys(now: Date): string[] {
  return Array.from({ length: HISTORY_MONTHS }, (_, i) => {
    const d = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - (HISTORY_MONTHS - 1 - i),
        1,
      ),
    );
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${d.getUTCFullYear()}-${mm}`;
  });
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
  return { percentage: floorPct(up / total), up, total, shown };
}

function durationMonth(
  days: DayCount[] | null,
  events: Event[],
  nowMs: number,
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
  const windows = withChecks.map((d) => dayWindow(d.day));
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
  notBeforeMs?: number,
): MonthValue {
  const { start, end } = monthRange(`${key}-01`);
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
): MonthValue {
  if (coverageStartMs === null) return null;
  const { start, end } = monthRange(`${key}-01`);
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
  const rolling = {} as HistoryValues["rolling"];
  for (const w of WINDOWS) {
    let up = 0;
    let total = 0;
    const shown = { ok: 0, degraded: 0, error: 0 };
    for (const key of months.slice(-w)) {
      const v = values.get(key);
      if (!v) continue;
      up += v.up;
      total += v.total;
      shown.ok += v.shown.ok;
      shown.degraded += v.shown.degraded;
      shown.error += v.shown.error;
    }
    rolling[windowKey(w)] =
      total > 0 ? { percentage: floorPct(up / total), ...shown } : null;
  }
  return {
    months: Object.fromEntries(
      months.map((k) => {
        const v = values.get(k);
        return [k, v ? { percentage: v.percentage, ...v.shown } : null];
      }),
    ),
    rolling,
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
  const mode = configuration.success ? configuration.data.value : "requests";

  const months = monthKeys(now);
  const currentKey = months[months.length - 1];
  const previousKey = months[months.length - 2];

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
  const liveReads = fetchLiveDays({
    monitors: components.flatMap((c) => (c.monitor ? [c.monitor] : [])),
    pipes: args.pipes ?? uptimeFreezePipes(defaultTb),
    sleep: args.sleep,
  });

  const [{ frozenRows }, { days: liveDays, failedMonitorIds: liveFailed }] =
    await Promise.all([dbReads, liveReads]);
  const frozenByKey = new Map(
    frozenRows.map((r) => [
      `${r.monitorId}:${r.month.slice(0, 7)}`,
      frozenMonitorUptimeDaySchema.array().parse(r.days),
    ]),
  );

  function daysFor(
    monitorId: number,
    key: string,
  ): FrozenMonitorUptimeDay[] | null {
    const frozen = frozenByKey.get(`${monitorId}:${key}`);
    if (frozen && key !== currentKey) return frozen;
    // Unfrozen months need full retention coverage, just like the freeze job.
    const isLive =
      key === currentKey ||
      (key === previousKey &&
        nowMs - monthRange(`${key}-01`).start < FREEZE_CUTOFF_MS);
    if (!isLive || liveFailed.has(String(monitorId))) return null;
    const days = [...(liveDays.get(String(monitorId))?.values() ?? [])]
      .filter((d) => d.day.startsWith(key))
      .sort((a, b) => (a.day < b.day ? -1 : 1));
    return days.length > 0 ? days : null;
  }

  // a day without `runs` is left out of the runs view, never derived
  function countsFor(
    monitorId: number,
    key: string,
    metric: "requests" | "runs" = "requests",
  ): DayCount[] | null {
    const days = daysFor(monitorId, key);
    if (!days) return null;
    return days.flatMap((d) => {
      const counts = d[metric];
      return counts ? [{ day: d.day, ...counts }] : [];
    });
  }

  const pastDays = HISTORY_MONTHS * 31 + 7;
  const rows: UptimeHistoryRow[] = components.map((c) => {
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
        );
      } else if (c.type === "monitor" && c.monitorId !== null) {
        const days = countsFor(c.monitorId, key);
        if (mode === "requests") {
          value = requestsMonth(days);
        } else if (mode === "duration") {
          value = durationMonth(days, events, nowMs);
        } else {
          // manual mode still keys "did the monitor run" off counts: a
          // zero-check month has no meaningful uptime in any mode
          value = days?.some((d) => d.ok + d.degraded + d.error > 0)
            ? eventOnlyMonth(events, key, nowMs)
            : null;
        }
      } else {
        value = eventOnlyMonth(
          events,
          key,
          nowMs,
          c.createdAt?.getTime() ?? undefined,
        );
      }
      values.set(key, value);
    }

    const requestsId =
      heartbeatId === null && c.type === "monitor" && mode === "requests"
        ? c.monitorId
        : null;
    const runValues = new Map<string, MonthValue>();
    if (requestsId !== null) {
      for (const key of months) {
        runValues.set(key, requestsMonth(countsFor(requestsId, key, "runs")));
      }
    }

    return {
      component: {
        id: c.id,
        name: c.name,
        type: c.type === "static" ? ("static" as const) : ("monitor" as const),
        monitorId: c.monitorId,
      },
      unit: requestsId !== null ? ("requests" as const) : ("time" as const),
      ...historyValues(months, values),
      runs: requestsId !== null ? historyValues(months, runValues) : null,
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

  const summary = {} as UptimeHistoryResult["summary"];
  for (const w of WINDOWS) {
    const windowStart = monthRange(`${months[months.length - w]}-01`).start;
    const seen = new Set<number>();
    for (const e of pageEvents) {
      if (e.type !== "report") continue;
      const endMs = e.to?.getTime() ?? nowMs;
      if (e.from.getTime() <= nowMs && endMs >= windowStart) {
        seen.add(e.id);
      }
    }
    const wk = windowKey(w);
    summary[wk] = {
      uptime: averageUptime(rows.map((r) => r.rolling[wk])),
      runsUptime: averageUptime(rows.map((r) => (r.runs ?? r).rolling[wk])),
      reports: seen.size,
    };
  }

  return {
    mode,
    months,
    createdAt: _page.createdAt,
    summary,
    rows,
  };
}
